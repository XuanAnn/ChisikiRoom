package com.chisikiroom.calling.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "call_participants")
@IdClass(CallParticipantEntity.Key.class)
public class CallParticipantEntity {

    @Id
    @Column(name = "call_id", nullable = false)
    public UUID callId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "camera", nullable = false)
    public boolean camera;

    @Column(name = "last_seen", nullable = false)
    public OffsetDateTime lastSeen;

    public static class Key implements Serializable {

        public UUID callId;
        public UUID userId;

        public Key() {}

        public Key(UUID callId, UUID userId) {
            this.callId = callId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            return (
                other instanceof Key k &&
                Objects.equals(callId, k.callId) &&
                Objects.equals(userId, k.userId)
            );
        }

        @Override
        public int hashCode() {
            return Objects.hash(callId, userId);
        }
    }
}
