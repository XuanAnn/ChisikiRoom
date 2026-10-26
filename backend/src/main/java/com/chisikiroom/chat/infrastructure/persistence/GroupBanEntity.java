package com.chisikiroom.chat.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "group_bans")
@IdClass(GroupBanEntity.Key.class)
public class GroupBanEntity {

    @Id
    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "blocked_by", nullable = false)
    public UUID blockedBy;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();

    public static class Key implements Serializable {

        public UUID roomId;
        public UUID userId;

        public Key() {}

        public Key(UUID roomId, UUID userId) {
            this.roomId = roomId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            return (
                other instanceof Key k &&
                Objects.equals(roomId, k.roomId) &&
                Objects.equals(userId, k.userId)
            );
        }

        @Override
        public int hashCode() {
            return Objects.hash(roomId, userId);
        }
    }
}
