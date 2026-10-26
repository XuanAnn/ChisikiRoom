package com.chisikiroom.battle.application;

import com.chisikiroom.battle.domain.BattleRules;
import com.chisikiroom.battle.infrastructure.persistence.entity.BattleAnswerEntity;
import com.chisikiroom.battle.infrastructure.persistence.entity.BattleEntity;
import com.chisikiroom.battle.infrastructure.persistence.entity.BattleEventEntity;
import com.chisikiroom.battle.infrastructure.persistence.entity.BattlePlayerEntity;
import com.chisikiroom.battle.infrastructure.persistence.entity.BattleRoundEntity;
import com.chisikiroom.battle.infrastructure.persistence.entity.ScoreEventEntity;
import com.chisikiroom.battle.infrastructure.persistence.repository.BattleRepository;
import com.chisikiroom.chat.application.ChatService;
import com.chisikiroom.quiz.application.QuizService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class BattleService {

    private final BattleRepository repository;
    private final ChatService chatService;
    private final QuizService quizService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public BattleService(
        BattleRepository repository,
        ChatService chatService,
        QuizService quizService,
        ObjectMapper objectMapper,
        Clock clock
    ) {
        this.repository = repository;
        this.chatService = chatService;
        this.quizService = quizService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public record Player(
        UUID id,
        String displayName,
        int score,
        boolean ready,
        boolean camera,
        String status,
        OffsetDateTime lastSeen
    ) {}

    public record RoundView(
        UUID id,
        int number,
        String status,
        String text,
        List<String> options,
        Integer correctIndex,
        OffsetDateTime deadlineAt,
        OffsetDateTime nextQuestionAt,
        UUID winnerId,
        String reason,
        boolean answered
    ) {}

    public record Snapshot(
        UUID id,
        UUID roomId,
        UUID ownerId,
        String title,
        String status,
        int totalQuestions,
        long sequence,
        OffsetDateTime serverTime,
        List<Player> players,
        RoundView round,
        String rankedResult,
        String rankedLevel
    ) {}

    OffsetDateTime now() {
        return OffsetDateTime.now(clock);
    }

    private ResponseStatusException error(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private BattleEntity battle(UUID id, boolean lock) {
        return (lock ? repository.lockBattle(id) : repository.findBattle(id)).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy trận")
        );
    }

    private List<BattlePlayerEntity> entities(UUID id) {
        return repository.findPlayers(id);
    }

    public List<Player> players(UUID id) {
        return entities(id)
            .stream()
            .map(player ->
                new Player(
                    player.userId,
                    repository.findUser(player.userId).orElseThrow().displayName,
                    player.score,
                    player.ready,
                    player.camera,
                    player.status,
                    player.lastSeen
                )
            )
            .toList();
    }

    private BattlePlayerEntity player(UUID id, UUID user) {
        BattleEntity target = battle(id, false);
        if (target.roomId != null) {
            chatService.requireMember(target.roomId, user);
        }
        return repository
            .findPlayer(id, user)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chưa tham gia trận")
            );
    }

    private BattleRoundEntity round(UUID id, int number) {
        if (number == 0) {
            return null;
        }
        return repository.findRound(id, number).orElseThrow();
    }

    private QuizService.Question question(String value) {
        try {
            return objectMapper.readValue(value, QuizService.Question.class);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String encode(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public List<Snapshot> list(UUID room, UUID user) {
        chatService.requireMember(room, user);
        return repository
            .findRecentBattleIds(room)
            .stream()
            .map(id -> snapshot(id, user))
            .toList();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Snapshot snapshot(UUID id, UUID user) {
        var battleEntity = battle(id, false);
        var people = players(id);
        if (battleEntity.roomId != null) {
            chatService.requireMember(battleEntity.roomId, user);
        }
        if (people.stream().noneMatch(player -> player.id().equals(user))) {
            if (battleEntity.roomId == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
            chatService.requireMember(battleEntity.roomId, user);
        }
        var roundEntity = round(id, battleEntity.roundNo);
        RoundView view = null;
        if (roundEntity != null) {
            var question = question(roundEntity.questionSnapshot);
            boolean answered = repository.findAnswer(roundEntity.id, user).isPresent();
            view = new RoundView(
                roundEntity.id,
                roundEntity.roundNo,
                roundEntity.status,
                question.text(),
                question.options(),
                roundEntity.status.equals("OPEN") ? null : question.correctIndex(),
                roundEntity.deadlineAt,
                roundEntity.nextQuestionAt,
                roundEntity.winnerId,
                roundEntity.resolutionReason,
                answered
            );
        }
        return new Snapshot(
            id,
            battleEntity.roomId,
            battleEntity.ownerId,
            battleEntity.title,
            battleEntity.status,
            battleEntity.questionSnapshot == null
                ? 0
                : quizService.decode(battleEntity.questionSnapshot).size(),
            battleEntity.sequence,
            now(),
            people,
            view,
            battleEntity.rankedResult,
            battleEntity.rankedLevel
        );
    }

    @Transactional
    public Snapshot create(UUID room, UUID quiz, UUID user) {
        chatService.lockRoom(room, user);
        chatService.requireMember(room, user);
        var question = quizService.get(quiz, user);
        var battleEntity = new BattleEntity();
        battleEntity.id = UUID.randomUUID();
        battleEntity.roomId = room;
        battleEntity.questionSetId = quiz;
        battleEntity.ownerId = user;
        battleEntity.title = question.title();
        repository.insertBattle(battleEntity);
        addPlayer(battleEntity.id, user);
        event(battleEntity.id, "BATTLE_CREATED");
        return snapshot(battleEntity.id, user);
    }

    @Transactional
    public Snapshot createRanked(
        UUID first,
        UUID second,
        String level,
        List<QuizService.Question> questions
    ) {
        BattleEntity entity = new BattleEntity();
        entity.id = UUID.randomUUID();
        entity.ownerId = first;
        entity.questionSetId = UUID.fromString("9e590000-0000-4000-8000-000000000001");
        entity.title = "Xếp hạng " + level + " · 1–1";
        entity.rankedLevel = level;
        entity.questionSnapshot = encode(questions);
        repository.insertBattle(entity);
        addPlayer(entity.id, first);
        addPlayer(entity.id, second);
        event(entity.id, "RANKED_MATCHED");
        return snapshot(entity.id, first);
    }

    @Transactional
    public void tryStartRanked(UUID id) {
        BattleEntity entity = battle(id, true);
        if (entity.rankedLevel == null || !entity.status.equals("WAITING")) {
            return;
        }
        List<BattlePlayerEntity> players = entities(id);
        boolean allReady =
            players.size() == 2 &&
            players
                .stream()
                .allMatch(
                    player ->
                        player.status.equals("ACTIVE") &&
                        player.ready &&
                        player.camera &&
                        !player.lastSeen.isBefore(now().minusSeconds(10))
                );
        if (allReady) {
            start(id, entity.ownerId);
        }
    }

    @Transactional
    public void cancelRanked(UUID id) {
        BattleEntity entity = battle(id, true);
        if (entity.rankedLevel == null) {
            throw error("Không phải trận xếp hạng");
        }
        if (entity.status.equals("WAITING")) {
            finish(id, "CANCELLED");
        }
    }

    private void addPlayer(UUID id, UUID user) {
        var player = new BattlePlayerEntity();
        player.battleId = id;
        player.userId = user;
        player.lastSeen = now();
        repository.insertPlayer(player);
    }

    @Transactional
    public Snapshot join(UUID id, UUID user) {
        var battleEntity = battle(id, true);
        pruneMembership(battleEntity);
        if (battleEntity.rankedLevel != null) {
            player(id, user);
            if (!player(id, user).status.equals("ACTIVE")) {
                throw error("Bạn đã rời trận xếp hạng");
            }
            return snapshot(id, user);
        }
        if (battleEntity.roomId == null) {
            throw error("Phòng trò chuyện không còn tồn tại");
        }
        chatService.requireMember(battleEntity.roomId, user);
        var all = entities(id);
        var prior = all
            .stream()
            .filter(player -> player.userId.equals(user))
            .findFirst();
        if (prior.isPresent() && prior.get().status.equals("ACTIVE")) {
            return snapshot(id, user);
        }
        if (!battleEntity.status.equals("WAITING")) {
            throw error("Trận đã khóa danh sách");
        }
        if (
            all
                .stream()
                .filter(player -> player.status.equals("ACTIVE"))
                .count() >= BattleRules.MAX_PLAYERS
        ) {
            throw error("BATTLE_FULL: Phòng thi đấu đã đủ 4 người");
        }
        if (prior.isPresent()) {
            var player = prior.get();
            player.status = "ACTIVE";
            player.ready = false;
            player.camera = false;
            player.lastSeen = now();
            player.unavailableSince = null;
        } else {
            addPlayer(id, user);
        }
        event(id, "PLAYER_JOINED");
        return snapshot(id, user);
    }

    @Transactional
    public Snapshot heartbeat(UUID id, UUID user, boolean camera, boolean ready) {
        var battleEntity = battle(id, true);
        var player = player(id, user);
        if (!player.status.equals("ACTIVE")) {
            throw error("Bạn đã rời hoặc bỏ cuộc");
        }
        var expired = now().minusSeconds(BattleRules.RECOVERY_SECONDS);
        if (
            battleEntity.status.equals("IN_PROGRESS") &&
            (!player.lastSeen.isAfter(expired) ||
                (player.unavailableSince != null && !player.unavailableSince.isAfter(expired)))
        ) {
            tickLocked(battleEntity);
            return snapshot(id, user);
        }
        boolean changed = player.camera != camera || player.ready != (ready && camera);
        player.camera = camera;
        player.ready = ready && camera;
        player.lastSeen = now();
        player.unavailableSince = camera
            ? null
            : player.unavailableSince == null
              ? now()
              : player.unavailableSince;
        if (battleEntity.status.equals("IN_PROGRESS")) {
            tickLocked(battleEntity);
        }
        if (changed) {
            event(id, "PLAYER_STATE");
        }
        return snapshot(id, user);
    }

    @Transactional
    public Snapshot start(UUID id, UUID user) {
        var battleEntity = battle(id, true);
        pruneMembership(battleEntity);
        player(id, user);
        if (!battleEntity.ownerId.equals(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ chủ trận được bắt đầu");
        }
        if (!battleEntity.status.equals("WAITING")) {
            throw error("Trận đã bắt đầu");
        }
        var active = entities(id)
            .stream()
            .filter(player -> player.status.equals("ACTIVE"))
            .toList();
        if (
            active.size() < 2 ||
            active
                .stream()
                .anyMatch(
                    player ->
                        !player.ready ||
                        !player.camera ||
                        player.lastSeen.isBefore(now().minusSeconds(10))
                )
        ) {
            throw error("Cần ít nhất 2 người, tất cả bật camera và sẵn sàng");
        }
        List<QuizService.Question> questions;
        if (battleEntity.rankedLevel != null) {
            questions = quizService.decode(battleEntity.questionSnapshot);
        } else {
            var quiz = quizService.get(
                battleEntity.questionSetId,
                quizService.owner(battleEntity.questionSetId)
            );
            questions = quiz.questions();
            battleEntity.questionSnapshot = encode(questions);
            battleEntity.title = quiz.title();
        }
        battleEntity.status = "IN_PROGRESS";
        openRound(id, 1, questions.getFirst());
        event(id, "BATTLE_STARTED");
        return snapshot(id, user);
    }

    private void openRound(UUID id, int number, QuizService.Question question) {
        var roundEntity = new BattleRoundEntity();
        roundEntity.id = UUID.randomUUID();
        roundEntity.battleId = id;
        roundEntity.roundNo = number;
        roundEntity.questionSnapshot = encode(question);
        roundEntity.deadlineAt = now().plusSeconds(BattleRules.QUESTION_SECONDS);
        repository.insertRound(roundEntity);
        battle(id, false).roundNo = number;
        event(id, "QUESTION_STARTED");
    }

    @Transactional
    public Snapshot answer(UUID id, UUID user, UUID roundId, int option, UUID requestId) {
        var battleEntity = battle(id, true);
        var player = player(id, user);
        var prior = repository.findAnswerByRequest(requestId);
        if (prior.isPresent()) {
            var answerEntity = prior.get();
            if (
                !answerEntity.roundId.equals(roundId) ||
                !answerEntity.userId.equals(user) ||
                answerEntity.optionIndex != option
            ) {
                throw error("Request ID đã được sử dụng");
            }
            return snapshot(id, user);
        }
        if (
            !battleEntity.status.equals("IN_PROGRESS") ||
            !player.status.equals("ACTIVE") ||
            !player.camera ||
            player.lastSeen.isBefore(now().minusSeconds(10))
        ) {
            throw error("Không thể trả lời: kiểm tra trạng thái và camera");
        }
        var roundEntity = round(id, battleEntity.roundNo);
        if (
            !roundEntity.id.equals(roundId) ||
            !roundEntity.status.equals("OPEN") ||
            !now().isBefore(roundEntity.deadlineAt)
        ) {
            throw error("Câu hỏi đã đóng");
        }
        if (repository.findAnswer(roundId, user).isPresent()) {
            throw error("Bạn chỉ được trả lời một lần mỗi câu");
        }
        var question = question(roundEntity.questionSnapshot);
        if (option < 0 || option >= question.options().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phương án không hợp lệ");
        }
        var answerEntity = new BattleAnswerEntity();
        answerEntity.roundId = roundId;
        answerEntity.userId = user;
        answerEntity.requestId = requestId;
        answerEntity.optionIndex = option;
        answerEntity.isCorrect = option == question.correctIndex();
        repository.insertAnswer(answerEntity);
        if (answerEntity.isCorrect) {
            resolve(id, roundEntity, user);
        } else {
            event(id, "ANSWER_ACCEPTED");
        }
        return snapshot(id, user);
    }

    private void resolve(UUID id, BattleRoundEntity round, UUID winner) {
        if (!round.status.equals("OPEN")) {
            return;
        }
        round.status = "RESOLVED";
        round.winnerId = winner;
        round.resolutionReason = winner == null ? "TIMEOUT" : "CORRECT";
        round.nextQuestionAt = now().plusSeconds(2);
        if (winner != null) {
            for (var player : entities(id)) {
                if (player.status.equals("ACTIVE")) {
                    int delta = BattleRules.scoreDelta(player.userId.equals(winner));
                    var event = new ScoreEventEntity();
                    event.roundId = round.id;
                    event.userId = player.userId;
                    event.delta = delta;
                    repository.insertScoreEvent(event);
                    player.score += delta;
                }
            }
        }
        event(id, "ROUND_RESOLVED");
    }

    @Transactional
    public Snapshot leave(UUID id, UUID user) {
        var battleEntity = battle(id, true);
        var player = player(id, user);
        player.status = "LEFT";
        player.ready = false;
        player.camera = false;
        var remaining = entities(id)
            .stream()
            .filter(item -> item.status.equals("ACTIVE"))
            .toList();
        if (battleEntity.status.equals("WAITING")) {
            if (battleEntity.rankedLevel != null) {
                battleEntity.status = "CANCELLED";
            } else if (remaining.isEmpty()) {
                battleEntity.status = "CANCELLED";
            } else if (battleEntity.ownerId.equals(user)) {
                battleEntity.ownerId = remaining.getFirst().userId;
            }
        } else if (battleEntity.status.equals("IN_PROGRESS") && remaining.size() < 2) {
            finish(id, "FINISHED");
        }
        event(id, "PLAYER_LEFT");
        return snapshot(id, user);
    }

    public void requireMediaPlayer(UUID id, UUID user) {
        var participant = player(id, user);
        if (!participant.status.equals("ACTIVE")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revokeRoomMember(UUID room) {
        for (UUID id : repository.roomBattleIds(room)) {
            pruneMembership(battle(id, true));
        }
    }

    private void pruneMembership(BattleEntity battle) {
        if (battle.roomId == null || !Set.of("WAITING", "IN_PROGRESS").contains(battle.status)) {
            return;
        }
        Set<UUID> members = new HashSet<>(chatService.memberIds(battle.roomId));
        boolean changed = false;
        for (var participant : entities(battle.id)) {
            if (participant.status.equals("ACTIVE") && !members.contains(participant.userId)) {
                participant.status = "FORFEITED";
                participant.ready = false;
                participant.camera = false;
                changed = true;
            }
        }
        if (!changed) {
            return;
        }
        var remaining = entities(battle.id)
            .stream()
            .filter(player -> player.status.equals("ACTIVE"))
            .toList();
        if (battle.status.equals("WAITING")) {
            if (remaining.isEmpty()) {
                battle.status = "CANCELLED";
            } else if (
                remaining.stream().noneMatch(player -> player.userId.equals(battle.ownerId))
            ) {
                battle.ownerId = remaining.getFirst().userId;
            }
        } else if (remaining.size() < 2) {
            finish(battle.id, "FINISHED");
        }
        event(battle.id, "PLAYER_FORFEITED");
    }

    @Transactional
    public void tick(UUID id) {
        tickLocked(battle(id, true));
    }

    private void tickLocked(BattleEntity battleEntity) {
        pruneMembership(battleEntity);
        if (!battleEntity.status.equals("IN_PROGRESS")) {
            return;
        }
        int forfeited = 0;
        for (var player : entities(battleEntity.id)) {
            if (player.status.equals("ACTIVE")) {
                if (
                    player.lastSeen.isBefore(now().minusSeconds(10)) &&
                    player.unavailableSince == null
                ) {
                    player.unavailableSince = player.lastSeen;
                }
                if (
                    player.unavailableSince != null &&
                    !player.unavailableSince.isAfter(
                        now().minusSeconds(BattleRules.RECOVERY_SECONDS)
                    )
                ) {
                    player.status = "FORFEITED";
                    player.ready = false;
                    player.camera = false;
                    forfeited++;
                }
            }
        }
        if (forfeited > 0) {
            event(battleEntity.id, "PLAYER_FORFEITED");
        }
        if (
            entities(battleEntity.id)
                .stream()
                .filter(player -> player.status.equals("ACTIVE"))
                .count() < 2
        ) {
            finish(battleEntity.id, "FINISHED");
            return;
        }
        var roundEntity = round(battleEntity.id, battleEntity.roundNo);
        if (roundEntity.status.equals("OPEN") && !now().isBefore(roundEntity.deadlineAt)) {
            resolve(battleEntity.id, roundEntity, null);
        } else if (
            roundEntity.status.equals("RESOLVED") && !now().isBefore(roundEntity.nextQuestionAt)
        ) {
            var questions = quizService.decode(battleEntity.questionSnapshot);
            if (battleEntity.roundNo >= questions.size()) {
                finish(battleEntity.id, "FINISHED");
            } else {
                openRound(
                    battleEntity.id,
                    battleEntity.roundNo + 1,
                    questions.get(battleEntity.roundNo)
                );
            }
        }
    }

    private void finish(UUID id, String status) {
        BattleEntity entity = battle(id, false);
        if (entity.rankedLevel != null && entity.rankedResult == null) {
            List<BattlePlayerEntity> activePlayers = entities(id)
                .stream()
                .filter(player -> player.status.equals("ACTIVE"))
                .toList();
            entity.rankedResult = "VOID";
            if (status.equals("FINISHED") && activePlayers.size() == 1) {
                entity.rankedResult = activePlayers.getFirst().userId.toString();
            } else if (status.equals("FINISHED") && activePlayers.size() == 2) {
                BattlePlayerEntity first = activePlayers.get(0);
                BattlePlayerEntity second = activePlayers.get(1);
                entity.rankedResult = "DRAW";
                if (first.score > second.score) {
                    entity.rankedResult = first.userId.toString();
                } else if (second.score > first.score) {
                    entity.rankedResult = second.userId.toString();
                }
            }
        }
        entity.status = status;
        event(id, "BATTLE_FINISHED");
    }

    private void event(UUID id, String type) {
        var battleEntity = battle(id, false);
        battleEntity.sequence++;
        var event = new BattleEventEntity();
        event.id = UUID.randomUUID();
        event.battleId = id;
        event.sequence = battleEntity.sequence;
        event.eventType = type;
        repository.insertOutboxEvent(event);
    }
}
