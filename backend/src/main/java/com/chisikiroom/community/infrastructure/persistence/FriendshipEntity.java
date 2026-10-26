package com.chisikiroom.community.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "friendships")
@IdClass(FriendshipEntity.Key.class)
public class FriendshipEntity {

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Id
    @Column(name = "friend_id", nullable = false)
    public UUID friendId;

    public static class Key implements Serializable {

        public UUID userId;
        public UUID friendId;

        public Key() {}

        public Key(UUID userId, UUID friendId) {
            this.userId = userId;
            this.friendId = friendId;
        }

        @Override
        public boolean equals(Object other) {
            return (
                other instanceof Key k &&
                Objects.equals(userId, k.userId) &&
                Objects.equals(friendId, k.friendId)
            );
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, friendId);
        }
    }
}
