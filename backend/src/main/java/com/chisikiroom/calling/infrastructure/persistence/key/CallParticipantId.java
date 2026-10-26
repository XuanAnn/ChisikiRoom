package com.chisikiroom.calling.infrastructure.persistence.key;

import java.io.Serializable;
import java.util.*;

public class CallParticipantId implements Serializable {

    public UUID callId;
    public UUID userId;

    public CallParticipantId() {}

    public CallParticipantId(UUID callId, UUID userId) {
        this.callId = callId;
        this.userId = userId;
    }

    @Override
    public boolean equals(Object other) {
        return (
            other instanceof CallParticipantId otherId &&
            Objects.equals(callId, otherId.callId) &&
            Objects.equals(userId, otherId.userId)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(callId, userId);
    }
}
