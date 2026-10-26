package com.chisikiroom.community.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "friend_requests")
@IdClass(FriendRequestEntity.Key.class)
public class FriendRequestEntity {

    @Id
    @Column(name = "sender_id", nullable = false)
    public UUID senderId;

    @Id
    @Column(name = "recipient_id", nullable = false)
    public UUID recipientId;

    @Column(name = "status", nullable = false, length = 20)
    public String status = "PENDING";

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();

    public static class Key implements Serializable {

        public UUID senderId;
        public UUID recipientId;

        public Key() {}

        public Key(UUID senderId, UUID recipientId) {
            this.senderId = senderId;
            this.recipientId = recipientId;
        }

        @Override
        public boolean equals(Object other) {
            return (
                other instanceof Key k &&
                Objects.equals(senderId, k.senderId) &&
                Objects.equals(recipientId, k.recipientId)
            );
        }

        @Override
        public int hashCode() {
            return Objects.hash(senderId, recipientId);
        }
    }
}
