package com.chisikiroom.chat.infrastructure.persistence.key;

import java.io.Serializable;
import java.util.*;

public class ReactionId implements Serializable {

    public Long messageId;
    public UUID userId;
    public String emoji;

    public ReactionId() {}

    public ReactionId(Long messageId, UUID userId, String emoji) {
        this.messageId = messageId;
        this.userId = userId;
        this.emoji = emoji;
    }

    @Override
    public boolean equals(Object other) {
        return (
            other instanceof ReactionId otherId &&
            Objects.equals(messageId, otherId.messageId) &&
            Objects.equals(userId, otherId.userId) &&
            Objects.equals(emoji, otherId.emoji)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(messageId, userId, emoji);
    }
}
