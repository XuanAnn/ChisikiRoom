package com.chisikiroom.chat.infrastructure.persistence.key;

import java.io.Serializable;
import java.util.*;

public class RoomMemberId implements Serializable {

    public UUID roomId;
    public UUID userId;

    public RoomMemberId() {}

    public RoomMemberId(UUID roomId, UUID userId) {
        this.roomId = roomId;
        this.userId = userId;
    }

    @Override
    public boolean equals(Object other) {
        return (
            other instanceof RoomMemberId otherId &&
            Objects.equals(roomId, otherId.roomId) &&
            Objects.equals(userId, otherId.userId)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(roomId, userId);
    }
}
