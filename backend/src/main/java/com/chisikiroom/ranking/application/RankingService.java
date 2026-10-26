package com.chisikiroom.ranking.application;

import com.chisikiroom.battle.application.BattleService;
import com.chisikiroom.quiz.application.QuizService;
import com.chisikiroom.ranking.domain.Glicko2;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankedMatchEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankedQuestionEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankedQueueEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankingProfileEntity;
import com.chisikiroom.ranking.infrastructure.persistence.repository.RankingRepository;
import com.chisikiroom.realtime.application.Events;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.SecureRandom;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class RankingService {

    private static final LocalDate EPOCH = LocalDate.of(2026, 1, 5);
    private final RankingRepository repository;
    private final BattleService battles;
    private final ObjectMapper json;
    private final Clock clock;
    private final Events events;
    private final SecureRandom random = new SecureRandom();

    public RankingService(
        RankingRepository repository,
        BattleService battles,
        ObjectMapper json,
        Clock clock,
        Events events
    ) {
        this.repository = repository;
        this.battles = battles;
        this.json = json;
        this.clock = clock;
        this.events = events;
    }

    public record Season(int id, OffsetDateTime startsAt, OffsetDateTime endsAt) {}

    public record Entry(
        UUID userId,
        String displayName,
        double rating,
        double deviation,
        int games,
        int wins,
        int draws,
        boolean provisional,
        OffsetDateTime lastPlayedAt
    ) {}

    public record Board(String level, Season season, Entry me, List<Entry> leaders) {}

    public record QueueState(String status, String level, UUID battleId, OffsetDateTime joinedAt) {}

    public record MatchView(
        UUID battleId,
        String level,
        int season,
        String opponent,
        String status,
        String outcome,
        Double before,
        Double after,
        OffsetDateTime createdAt
    ) {}

    public record BankEntry(UUID id, String level, QuizService.Question question) {}

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock);
    }

    private void validateLevel(String level) {
        if (!"N5".equals(level) && !"N4".equals(level)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Trình độ phải là N5 hoặc N4"
            );
        }
    }

    public Season season() {
        long days = ChronoUnit.DAYS.between(
            EPOCH,
            clock.instant().atZone(ZoneOffset.UTC).toLocalDate()
        );
        int index = (int) Math.floorDiv(days, 56);
        OffsetDateTime start = EPOCH.plusDays(index * 56L)
            .atStartOfDay()
            .atOffset(ZoneOffset.UTC);
        return new Season(index + 1, start, start.plusDays(56));
    }

    private Entry view(UUID user, RankingProfileEntity profile) {
        if (profile == null) {
            return new Entry(user, repository.name(user), 1500, 350, 0, 0, 0, true, null);
        }
        return new Entry(
            user,
            repository.name(user),
            profile.rating,
            rating(profile).deviation(),
            profile.games,
            profile.wins,
            profile.draws,
            profile.games < 5,
            profile.games == 0 ? null : profile.updatedAt
        );
    }

    public Board board(UUID user, String level) {
        validateLevel(level);
        Season season = season();
        RankingProfileEntity mine = repository.profile(user, level, season.id()).orElse(null);
        if (mine == null) {
            RankingProfileEntity previous = repository
                .profile(user, level, season.id() - 1)
                .orElse(null);
            if (previous != null) {
                mine = new RankingProfileEntity();
                mine.userId = user;
                mine.rating = (previous.rating + 1500) / 2;
                mine.deviation = Math.max(200, previous.deviation);
                mine.volatility = previous.volatility;
                mine.updatedAt = now();
            }
        }
        return new Board(
            level,
            season,
            view(user, mine),
            repository
                .board(level, season.id())
                .stream()
                .map(profile -> view(profile.userId, profile))
                .toList()
        );
    }

    private RankingProfileEntity profile(UUID user, String level, int season) {
        Optional<RankingProfileEntity> existing = repository.profile(user, level, season);
        if (existing.isPresent()) {
            return existing.get();
        }
        RankingProfileEntity profile = new RankingProfileEntity();
        profile.id = UUID.randomUUID();
        profile.userId = user;
        profile.level = level;
        profile.season = season;
        profile.rating = 1500;
        profile.deviation = 350;
        profile.volatility = 0.06;
        profile.updatedAt = now();
        repository.profile(user, level, season - 1).ifPresent(previous -> {
            profile.rating = (previous.rating + 1500) / 2;
            profile.deviation = Math.max(200, previous.deviation);
            profile.volatility = previous.volatility;
        });
        repository.insertProfile(profile);
        return profile;
    }

    private Glicko2.Rating rating(RankingProfileEntity profile) {
        long inactiveDays = Math.max(0, ChronoUnit.DAYS.between(profile.updatedAt, now()));
        return Glicko2.inactive(
            new Glicko2.Rating(profile.rating, profile.deviation, profile.volatility),
            inactiveDays
        );
    }

    public QueueState state(UUID user) {
        return repository
            .queue(user)
            .map(queue ->
                new QueueState(
                    queue.matchId == null ? "QUEUED" : "MATCHED",
                    queue.level,
                    queue.matchId,
                    queue.joinedAt
                )
            )
            .orElse(new QueueState("IDLE", null, null, null));
    }

    @Transactional
    public QueueState join(UUID user, String level) {
        validateLevel(level);
        repository.lock();
        Optional<RankedQueueEntity> existing = repository.queue(user);
        if (existing.isPresent()) {
            if (!existing.get().level.equals(level)) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Hãy hủy hàng chờ hiện tại trước khi đổi trình độ"
                );
            }
            existing.get().lastSeen = now();
            return state(user);
        }
        RankedQueueEntity queue = new RankedQueueEntity();
        queue.userId = user;
        queue.level = level;
        queue.season = season().id();
        queue.joinedAt = now();
        queue.lastSeen = now();
        profile(user, level, queue.season);
        repository.insertQueue(queue);
        repository.flush();
        pair(queue);
        return state(user);
    }

    @Transactional
    public QueueState heartbeat(UUID user) {
        repository.lock();
        repository.queue(user).ifPresent(queue -> queue.lastSeen = now());
        return state(user);
    }

    @Transactional
    public QueueState cancel(UUID user) {
        repository.lock();
        repository.queue(user).ifPresent(queue -> {
            if (queue.matchId != null) {
                BattleService.Snapshot battle = battles.snapshot(queue.matchId, user);
                if (battle.status().equals("IN_PROGRESS")) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Hãy rời cửa sổ Battle; trận đang chạy sẽ tính bỏ cuộc"
                    );
                }
                if (battle.status().equals("WAITING")) {
                    battles.leave(queue.matchId, user);
                }
                settle(repository.match(queue.matchId));
            } else {
                repository.removeQueue(queue);
            }
        });
        return state(user);
    }

    private boolean eligible(RankedQueueEntity first, RankedQueueEntity second) {
        if (
            first.userId.equals(second.userId) ||
            second.matchId != null ||
            first.season != second.season ||
            !first.level.equals(second.level) ||
            second.lastSeen.isBefore(now().minusSeconds(20))
        ) {
            return false;
        }
        List<RankedMatchEntity> recent = repository.recentPair(
            first.userId,
            second.userId,
            now().minusDays(1)
        );
        if (
            recent.size() >= 3 ||
            (!recent.isEmpty() && recent.getFirst().createdAt.isAfter(now().minusMinutes(5)))
        ) {
            return false;
        }
        double firstRating = profile(first.userId, first.level, first.season).rating;
        double secondRating = profile(second.userId, second.level, second.season).rating;
        long waiting = Math.max(0, ChronoUnit.SECONDS.between(first.joinedAt, now()));
        double range = Math.min(600, 200 + waiting * 5);
        return Math.abs(firstRating - secondRating) <= range;
    }

    private void pair(RankedQueueEntity queue) {
        if (queue.matchId != null) {
            return;
        }
        double ownRating = profile(queue.userId, queue.level, queue.season).rating;
        Optional<RankedQueueEntity> candidate = repository
            .queues()
            .stream()
            .filter(other -> eligible(queue, other))
            .min(
                Comparator.comparingDouble(other ->
                    Math.abs(profile(other.userId, other.level, other.season).rating - ownRating)
                )
            );
        if (candidate.isEmpty()) {
            return;
        }
        RankedQueueEntity other = candidate.get();
        List<QuizService.Question> questions = selectQuestions(queue.level);
        BattleService.Snapshot battle = battles.createRanked(
            queue.userId,
            other.userId,
            queue.level,
            questions
        );
        RankedMatchEntity match = new RankedMatchEntity();
        match.id = battle.id();
        match.season = queue.season;
        match.level = queue.level;
        match.firstUser = queue.userId;
        match.secondUser = other.userId;
        match.status = "MATCHED";
        match.createdAt = now();
        repository.insertMatch(match);
        queue.matchId = match.id;
        other.matchId = match.id;
        events.send(
            List.of(match.firstUser, match.secondUser),
            "RANKED_MATCHED",
            Map.of("battleId", match.id)
        );
    }

    private List<QuizService.Question> selectQuestions(String level) {
        List<RankedQuestionEntity> bank = new ArrayList<>(repository.questions(level));
        if (bank.size() < 10) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Chưa đủ câu hỏi xếp hạng"
            );
        }
        Collections.shuffle(bank, random);
        List<QuizService.Question> selected = new ArrayList<>();
        for (RankedQuestionEntity entity : bank.subList(0, 10)) {
            try {
                QuizService.Question question = json.readValue(
                    entity.content,
                    QuizService.Question.class
                );
                List<Integer> indexes = new ArrayList<>();
                for (int index = 0; index < question.options().size(); index++) {
                    indexes.add(index);
                }
                Collections.shuffle(indexes, random);
                List<String> options = indexes
                    .stream()
                    .map(index -> question.options().get(index))
                    .toList();
                selected.add(
                    new QuizService.Question(
                        question.text(),
                        options,
                        indexes.indexOf(question.correctIndex()),
                        null
                    )
                );
            } catch (Exception exception) {
                throw new IllegalStateException("Invalid ranking question", exception);
            }
        }
        return selected;
    }

    @Transactional
    public void installBank(List<BankEntry> entries) {
        repository.lock();
        for (BankEntry entry : entries) {
            validateLevel(entry.level());
            if (repository.hasQuestion(entry.id())) {
                continue;
            }
            RankedQuestionEntity question = new RankedQuestionEntity();
            question.id = entry.id();
            question.level = entry.level();
            try {
                question.content = json.writeValueAsString(entry.question());
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
            repository.insertQuestion(question);
        }
    }

    private void apply(RankingProfileEntity profile, Glicko2.Rating next, double score) {
        profile.rating = next.value();
        profile.deviation = next.deviation();
        profile.volatility = next.volatility();
        profile.games++;
        if (score == 1) {
            profile.wins++;
        }
        if (score == 0.5) {
            profile.draws++;
        }
        profile.updatedAt = now();
    }

    private void settle(RankedMatchEntity match) {
        if (!match.status.equals("MATCHED")) {
            return;
        }
        BattleService.Snapshot battle = battles.snapshot(match.id, match.firstUser);
        if (!battle.status().equals("FINISHED") && !battle.status().equals("CANCELLED")) {
            return;
        }
        match.finishedAt = now();
        match.status = "VOID";
        match.outcome = "VOID";
        String result = battle.rankedResult();
        if (battle.status().equals("FINISHED") && result != null && !result.equals("VOID")) {
            RankingProfileEntity first = profile(match.firstUser, match.level, match.season);
            RankingProfileEntity second = profile(match.secondUser, match.level, match.season);
            Glicko2.Rating firstBefore = rating(first);
            Glicko2.Rating secondBefore = rating(second);
            double score = 0.5;
            if (result.equals(match.firstUser.toString())) {
                score = 1;
            } else if (result.equals(match.secondUser.toString())) {
                score = 0;
            }
            Glicko2.Rating firstAfter = Glicko2.update(
                firstBefore,
                List.of(new Glicko2.Opponent(secondBefore.value(), secondBefore.deviation(), score))
            );
            Glicko2.Rating secondAfter = Glicko2.update(
                secondBefore,
                List.of(
                    new Glicko2.Opponent(firstBefore.value(), firstBefore.deviation(), 1 - score)
                )
            );
            match.firstBefore = firstBefore.value();
            match.secondBefore = secondBefore.value();
            match.firstAfter = firstAfter.value();
            match.secondAfter = secondAfter.value();
            match.status = "RATED";
            match.outcome = "SECOND_WIN";
            if (result.equals("DRAW")) {
                match.outcome = "DRAW";
            } else if (score == 1) {
                match.outcome = "FIRST_WIN";
            }
            apply(first, firstAfter, score);
            apply(second, secondAfter, 1 - score);
        }
        for (UUID user : List.of(match.firstUser, match.secondUser)) {
            repository
                .queue(user)
                .filter(queue -> match.id.equals(queue.matchId))
                .ifPresent(repository::removeQueue);
        }
        events.send(
            List.of(match.firstUser, match.secondUser),
            "RANKED_SETTLED",
            Map.of("battleId", match.id)
        );
    }

    @Transactional
    public void tick() {
        repository.lock();
        for (RankedMatchEntity match : repository.pending()) {
            if (match.createdAt.isBefore(now().minusSeconds(60))) {
                battles.cancelRanked(match.id);
            }
            battles.tryStartRanked(match.id);
            settle(match);
        }
        for (RankedQueueEntity queue : repository.queues()) {
            if (queue.matchId != null) {
                continue;
            }
            if (queue.lastSeen.isBefore(now().minusSeconds(20)) || queue.season != season().id()) {
                repository.removeQueue(queue);
            } else {
                pair(queue);
            }
        }
    }

    public List<MatchView> history(UUID user) {
        return repository
            .history(user)
            .stream()
            .map(match -> {
                boolean first = match.firstUser.equals(user);
                String outcome = match.outcome;
                if ("FIRST_WIN".equals(outcome)) {
                    outcome = first ? "WIN" : "LOSS";
                } else if ("SECOND_WIN".equals(outcome)) {
                    outcome = first ? "LOSS" : "WIN";
                }
                return new MatchView(
                    match.id,
                    match.level,
                    match.season,
                    repository.name(first ? match.secondUser : match.firstUser),
                    match.status,
                    outcome,
                    first ? match.firstBefore : match.secondBefore,
                    first ? match.firstAfter : match.secondAfter,
                    match.createdAt
                );
            })
            .toList();
    }
}
