package com.chisikiroom.community.infrastructure.persistence.key;

import java.io.Serializable;
import java.util.*;

public class FriendRequestId implements Serializable {

    public UUID senderId;
    public UUID recipientId;

    public FriendRequestId() {}

    public FriendRequestId(UUID senderId, UUID recipientId) {
        this.senderId = senderId;
        this.recipientId = recipientId;
    }

    @Override
    public boolean equals(Object other) {
        return (
            other instanceof FriendRequestId otherId &&
            Objects.equals(senderId, otherId.senderId) &&
            Objects.equals(recipientId, otherId.recipientId)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(senderId, recipientId);
    }
}
