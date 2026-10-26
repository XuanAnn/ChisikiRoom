package com.chisikiroom.chat.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "message_reactions")
@IdClass(ReactionEntity.Key.class)
public class ReactionEntity {

    @Id
    @Column(name = "message_id", nullable = false)
    public Long messageId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Id
    @Column(name = "emoji", nullable = false, length = 20)
    public String emoji;

    public static class Key implements Serializable {

        public Long messageId;
        public UUID userId;
        public String emoji;

        public Key() {}

        public Key(Long messageId, UUID userId, String emoji) {
            this.messageId = messageId;
            this.userId = userId;
            this.emoji = emoji;
        }

        @Override
        public boolean equals(Object other) {
            return (
                other instanceof Key k &&
                Objects.equals(messageId, k.messageId) &&
                Objects.equals(userId, k.userId) &&
                Objects.equals(emoji, k.emoji)
            );
        }

        @Override
        public int hashCode() {
            return Objects.hash(messageId, userId, emoji);
        }
    }
}
