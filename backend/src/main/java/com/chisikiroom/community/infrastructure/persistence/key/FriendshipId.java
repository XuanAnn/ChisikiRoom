package com.chisikiroom.community.infrastructure.persistence.key;

import java.io.Serializable;
import java.util.*;

public class FriendshipId implements Serializable {

    public UUID userId;
    public UUID friendId;

    public FriendshipId() {}

    public FriendshipId(UUID userId, UUID friendId) {
        this.userId = userId;
        this.friendId = friendId;
    }

    @Override
    public boolean equals(Object other) {
        return (
            other instanceof FriendshipId otherId &&
            Objects.equals(userId, otherId.userId) &&
            Objects.equals(friendId, otherId.friendId)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, friendId);
    }
}
