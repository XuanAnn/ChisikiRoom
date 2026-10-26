package com.chisikiroom.chat.infrastructure.persistence;

import com.chisikiroom.common.infrastructure.JpaStore;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class ReactionRepository {

    private final JpaStore persistence;

    public ReactionRepository(JpaStore persistence) {
        this.persistence = persistence;
    }

    public List<ReactionEntity> findRecentByRoom(UUID roomId) {
        return persistence.limited(
            ReactionEntity.class,
            """
            select reaction from ReactionEntity reaction, MessageEntity message
            where message.id = reaction.messageId and message.roomId = :room and message.deletedAt is null
            order by message.id desc
            """,
            5000,
            "room",
            roomId
        );
    }

    public boolean messageBelongsToRoom(long messageId, UUID roomId) {
        return persistence
            .find(MessageEntity.class, messageId)
            .filter(message -> message.roomId.equals(roomId) && message.deletedAt == null)
            .isPresent();
    }

    public Optional<ReactionEntity> find(long messageId, UUID userId, String emoji) {
        return persistence.find(
            ReactionEntity.class,
            new ReactionEntity.Key(messageId, userId, emoji)
        );
    }

    public void insert(ReactionEntity reaction) {
        persistence.insert(reaction);
    }

    public void delete(ReactionEntity reaction) {
        persistence.delete(reaction);
    }
}
