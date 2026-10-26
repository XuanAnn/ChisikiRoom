package com.chisikiroom.chat.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "chat_room_members")
@IdClass(RoomMemberEntity.Key.class)
public class RoomMemberEntity {

    @Id
    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "joined_at", nullable = false)
    public OffsetDateTime joinedAt = OffsetDateTime.now();

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
