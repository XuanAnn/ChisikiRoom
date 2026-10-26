package com.chisikiroom.calling.application;

import com.chisikiroom.calling.domain.CallPolicy;
import com.chisikiroom.calling.infrastructure.persistence.entity.CallParticipantEntity;
import com.chisikiroom.calling.infrastructure.persistence.entity.RoomCallEntity;
import com.chisikiroom.calling.infrastructure.persistence.repository.CallRepository;
import com.chisikiroom.chat.application.ChatService;
import com.chisikiroom.realtime.application.Events;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class CallService {

    private final CallRepository repository;
    private final ChatService chatService;
    private final Events events;
    private final Clock clock;

    public CallService(
        CallRepository repository,
        ChatService chatService,
        Events events,
        Clock clock
    ) {
        this.repository = repository;
        this.chatService = chatService;
        this.events = events;
        this.clock = clock;
    }

    public record Participant(UUID id, String displayName, boolean camera) {}

    public record View(
        UUID id,
        UUID roomId,
        UUID callerId,
        String status,
        long sequence,
        List<Participant> participants
    ) {}

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private RoomCallEntity find(UUID id) {
        return repository
            .findCall(id)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cuộc gọi")
            );
    }

    private List<CallParticipantEntity> participants(UUID id) {
        return repository.findParticipants(id);
    }

    private View view(RoomCallEntity callEntity) {
        return new View(
            callEntity.id,
            callEntity.roomId,
            callEntity.callerId,
            callEntity.status,
            callEntity.sequence,
            participants(callEntity.id)
                .stream()
                .map(participant ->
                    new Participant(
                        participant.userId,
                        repository.findUser(participant.userId).orElseThrow().displayName,
                        participant.camera
                    )
                )
                .toList()
        );
    }

    private RoomCallEntity lock(UUID id, UUID user) {
        // Read only a scalar before the aggregate lock to avoid caching stale participants.
        UUID room = repository
            .findRoomId(id)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cuộc gọi")
            );
        chatService.lockRoom(room, user);
        chatService.requireMember(room, user);
        return repository.lockCall(id).orElseThrow();
    }

    private void changed(RoomCallEntity call, String type) {
        call.sequence++;
        call.updatedAt = now();
        events.send(
            chatService.memberIds(call.roomId),
            type,
            Map.of(
                "callId",
                call.id,
                "roomId",
                call.roomId,
                "callerId",
                call.callerId,
                "sequence",
                call.sequence
            )
        );
    }

    private void expire(RoomCallEntity callEntity) {
        if (!callEntity.status.equals("ACTIVE")) {
            return;
        }
        var members = chatService.memberIds(callEntity.roomId);
        int removed = 0;
        List<UUID> revokedUsers = new ArrayList<>();
        for (var participant : participants(callEntity.id)) {
            if (
                participant.lastSeen.isBefore(now().minusSeconds(CallPolicy.DISCONNECT_SECONDS)) ||
                !members.contains(participant.userId)
            ) {
                repository.deleteParticipant(participant);
                revokedUsers.add(participant.userId);
                removed++;
            }
        }
        repository.flush();
        if (!revokedUsers.isEmpty()) {
            events.send(
                revokedUsers,
                "CALL_ENDED",
                Map.of("callId", callEntity.id, "roomId", callEntity.roomId)
            );
        }
        if (
            participants(callEntity.id).isEmpty() ||
            (!callEntity.answered &&
                callEntity.startedAt.isBefore(now().minusSeconds(CallPolicy.UNANSWERED_SECONDS)))
        ) {
            end(callEntity);
            return;
        }
        if (removed > 0) {
            changed(callEntity, "CALL_CHANGED");
        }
    }

    private void end(RoomCallEntity call) {
        call.status = "ENDED";
        participants(call.id).forEach(repository::deleteParticipant);
        changed(call, "CALL_ENDED");
    }

    @Transactional
    public View current(UUID room, UUID user) {
        chatService.lockRoom(room, user);
        chatService.requireMember(room, user);
        var call = repository.findByRoom(room);
        if (call.isEmpty()) {
            return null;
        }
        expire(call.get());
        return call.get().status.equals("ACTIVE") ? view(call.get()) : null;
    }

    @Transactional
    public View start(UUID room, UUID user) {
        lockUser(user);
        var active = current(room, user);
        if (active != null) {
            return joinLocked(find(active.id()), user);
        }
        requireAvailable(user);
        repository.findByRoom(room).ifPresent(callEntity -> {
            participants(callEntity.id).forEach(repository::deleteParticipant);
            repository.deleteCall(callEntity);
        });
        // Flush deletes before inserting a fresh session with the same unique room.
        repository.flush();
        var callEntity = new RoomCallEntity();
        callEntity.id = UUID.randomUUID();
        callEntity.roomId = room;
        callEntity.callerId = user;
        callEntity.status = "ACTIVE";
        callEntity.startedAt = now();
        callEntity.updatedAt = now();
        repository.insertCall(callEntity);
        add(callEntity.id, user);
        events.send(
            chatService.memberIds(room),
            "CALL_INVITED",
            Map.of("callId", callEntity.id, "roomId", room, "callerId", user)
        );
        return view(callEntity);
    }

    private void lockUser(UUID user) {
        repository.lockUser(user).orElseThrow();
    }

    private void requireAvailable(UUID user) {
        if (repository.hasActiveCall(user, now().minusSeconds(CallPolicy.DISCONNECT_SECONDS))) {
            throw conflict("Bạn đang tham gia một cuộc gọi khác");
        }
    }

    private void add(UUID id, UUID user) {
        var participant = new CallParticipantEntity();
        participant.callId = id;
        participant.userId = user;
        participant.lastSeen = now();
        repository.insertParticipant(participant);
    }

    private View joinLocked(RoomCallEntity call, UUID user) {
        if (!call.status.equals("ACTIVE")) {
            throw conflict("Cuộc gọi đã kết thúc");
        }
        var people = participants(call.id);
        if (people.stream().anyMatch(participant -> participant.userId.equals(user))) {
            return view(call);
        }
        requireAvailable(user);
        if (people.size() >= CallPolicy.MAX_PARTICIPANTS) {
            throw conflict("Cuộc gọi P2P tối đa 4 người");
        }
        add(call.id, user);
        call.answered = true;
        changed(call, "CALL_CHANGED");
        return view(call);
    }

    @Transactional
    public View join(UUID id, UUID user) {
        lockUser(user);
        var call = lock(id, user);
        expire(call);
        return joinLocked(call, user);
    }

    @Transactional
    public View get(UUID id, UUID user) {
        var call = lock(id, user);
        expire(call);
        return view(call);
    }

    @Transactional
    public View heartbeat(UUID id, UUID user, boolean camera) {
        var call = lock(id, user);
        expire(call);
        requireParticipant(call, user);
        var participant = repository.findParticipant(id, user).orElseThrow();
        boolean changed = participant.camera != camera;
        participant.camera = camera;
        participant.lastSeen = now();
        if (changed) {
            changed(call, "CALL_CHANGED");
        }
        return view(call);
    }

    @Transactional
    public void leave(UUID id, UUID user) {
        var call = lock(id, user);
        if (!call.status.equals("ACTIVE")) {
            return;
        }
        var participant = repository.findParticipant(id, user);
        if (participant.isEmpty()) {
            return;
        }
        repository.deleteParticipant(participant.get());
        repository.flush();
        if (
            chatService.lockRoom(call.roomId, user).kind().equals("DIRECT") ||
            participants(id).isEmpty()
        ) {
            end(call);
        } else {
            changed(call, "CALL_CHANGED");
        }
    }

    @Transactional
    public void decline(UUID id, UUID user) {
        var call = lock(id, user);
        if (!call.status.equals("ACTIVE")) {
            return;
        }
        if (
            participants(id)
                .stream()
                .anyMatch(participant -> participant.userId.equals(user))
        ) {
            throw conflict("Hãy rời cuộc gọi đang tham gia");
        }
        if (chatService.lockRoom(call.roomId, user).kind().equals("DIRECT")) {
            end(call);
        }
    }

    private void requireParticipant(RoomCallEntity call, UUID user) {
        if (!call.status.equals("ACTIVE") || repository.findParticipant(call.id, user).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chưa tham gia cuộc gọi");
        }
    }

    @Transactional
    public void signal(UUID id, UUID user, UUID target, String kind, Object payload) {
        var call = lock(id, user);
        expire(call);
        requireParticipant(call, user);
        requireParticipant(call, target);
        if (user.equals(target)) {
            throw conflict("Không thể signaling với chính mình");
        }
        events.send(
            List.of(target),
            "CALL_SIGNAL",
            Map.of("callId", id, "senderId", user, "kind", kind, "payload", payload)
        );
    }

    @Transactional
    public void requireMedia(UUID id, UUID user) {
        var call = lock(id, user);
        expire(call);
        requireParticipant(call, user);
    }

    @Transactional(
        propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW
    )
    public void cleanupRoomMembership(UUID room) {
        chatService.lockRoom(room, null);
        repository
            .findByRoom(room)
            .ifPresent(call -> repository.lockCall(call.id).ifPresent(this::expire));
    }

    public List<UUID> activeIds() {
        return repository.findActiveIds();
    }

    @Transactional
    public void sweep(UUID id) {
        var room = repository.findRoomId(id);
        if (room.isEmpty()) {
            return;
        }
        chatService.lockRoom(room.get(), null);
        var callEntity = repository.lockCall(id);
        callEntity.ifPresent(this::expire);
    }
}
