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

    @Column(nullable = false, length = 10)
    public String role = "MEMBER";

    @Column(name = "last_read_id", nullable = false)
    public Long lastReadId = 0L;

    @Column(nullable = false, columnDefinition = "text")
    public String draft = "";

    @Column(name = "draft_version", nullable = false)
    public Long draftVersion = 0L;

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
