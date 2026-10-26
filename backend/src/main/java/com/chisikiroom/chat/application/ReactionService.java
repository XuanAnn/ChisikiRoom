package com.chisikiroom.chat.application;

import com.chisikiroom.chat.infrastructure.persistence.entity.ReactionEntity;
import com.chisikiroom.chat.infrastructure.persistence.repository.ReactionRepository;
import com.chisikiroom.realtime.application.Events;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ReactionService {

    private static final Set<String> ALLOWED_EMOJI = Set.of("👍", "❤️", "🎉", "😂", "🔥");
    private final ReactionRepository reactions;
    private final ChatService chat;
    private final Events events;

    public ReactionService(ReactionRepository reactions, ChatService chat, Events events) {
        this.reactions = reactions;
        this.chat = chat;
        this.events = events;
    }

    public record Reaction(long messageId, UUID userId, String emoji) {}

    public List<Reaction> list(UUID roomId, UUID userId) {
        chat.requireMember(roomId, userId);
        return reactions
            .findRecentByRoom(roomId)
            .stream()
            .map(reaction -> new Reaction(reaction.messageId, reaction.userId, reaction.emoji))
            .toList();
    }

    @Transactional
    public void toggle(UUID roomId, long messageId, UUID userId, String emoji) {
        chat.lockRoom(roomId, userId);
        chat.requireMember(roomId, userId);
        if (!ALLOWED_EMOJI.contains(emoji)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reaction không hợp lệ");
        }
        if (!reactions.messageBelongsToRoom(messageId, roomId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        var existingReaction = reactions.find(messageId, userId, emoji);
        if (existingReaction.isPresent()) {
            reactions.delete(existingReaction.get());
        } else {
            ReactionEntity reaction = new ReactionEntity();
            reaction.messageId = messageId;
            reaction.userId = userId;
            reaction.emoji = emoji;
            reactions.insert(reaction);
        }
        events.send(chat.memberIds(roomId), "REACTIONS_CHANGED", Map.of("roomId", roomId));
    }
}
