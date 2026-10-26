package com.chisikiroom.calling.infrastructure.persistence;

import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.identity.infrastructure.persistence.UserEntity;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Typed persistence operations; application services own business decisions and transactions. */
@Repository
public class CallRepository {

    private final JpaStore persistence;

    public CallRepository(JpaStore persistence) {
        this.persistence = persistence;
    }

    public Optional<RoomCallEntity> findCall(UUID callId) {
        return persistence.find(RoomCallEntity.class, callId);
    }

    public List<CallParticipantEntity> findParticipants(UUID callId) {
        return persistence.list(
            CallParticipantEntity.class,
            "from CallParticipantEntity p where p.callId=:id order by p.userId",
            "id",
            callId
        );
    }

    public Optional<UserEntity> findUser(UUID userId) {
        return persistence.find(UserEntity.class, userId);
    }

    public Optional<UUID> findRoomId(UUID callId) {
        return persistence.one(
            UUID.class,
            "select c.roomId from RoomCallEntity c where c.id=:id",
            "id",
            callId
        );
    }

    public Optional<RoomCallEntity> lockCall(UUID callId) {
        return persistence.lock(RoomCallEntity.class, callId);
    }

    public void deleteParticipant(CallParticipantEntity participant) {
        persistence.delete(participant);
    }

    public void flush() {
        persistence.flush();
    }

    public Optional<RoomCallEntity> findByRoom(UUID roomId) {
        return persistence.one(
            RoomCallEntity.class,
            "from RoomCallEntity c where c.roomId=:room",
            "room",
            roomId
        );
    }

    public void deleteCall(RoomCallEntity call) {
        persistence.delete(call);
    }

    public void insertCall(RoomCallEntity call) {
        persistence.insert(call);
    }

    public Optional<UserEntity> lockUser(UUID userId) {
        return persistence.lock(UserEntity.class, userId);
    }

    public boolean hasActiveCall(UUID userId, OffsetDateTime lastSeenCutoff) {
        return persistence.exists(
            "select count(p) from CallParticipantEntity p, RoomCallEntity c where p.callId=c.id and p.userId=:user and c.status='ACTIVE' and p.lastSeen>=:expired",
            "user",
            userId,
            "expired",
            lastSeenCutoff
        );
    }

    public void insertParticipant(CallParticipantEntity participant) {
        persistence.insert(participant);
    }

    public Optional<CallParticipantEntity> findParticipant(UUID callId, UUID userId) {
        return persistence.find(
            CallParticipantEntity.class,
            new CallParticipantEntity.Key(callId, userId)
        );
    }

    public List<UUID> findActiveIds() {
        return persistence.list(
            UUID.class,
            "select c.id from RoomCallEntity c where c.status='ACTIVE'"
        );
    }
}
