package com.chisikiroom.chat.presentation;

import com.chisikiroom.chat.application.ReactionService;
import com.chisikiroom.common.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat-rooms/{id}")
public class ReactionsController {

    private final ReactionService reactions;

    public ReactionsController(ReactionService reactions) {
        this.reactions = reactions;
    }

    public record Input(@NotNull String emoji) {}

    @GetMapping("/reactions")
    public List<ReactionService.Reaction> list(
        Authentication authentication,
        @PathVariable("id") UUID roomId
    ) {
        return reactions.list(roomId, CurrentUser.id(authentication));
    }

    @PostMapping("/messages/{message}/reactions")
    public void toggle(
        Authentication authentication,
        @PathVariable("id") UUID roomId,
        @PathVariable("message") long messageId,
        @Valid @RequestBody Input input
    ) {
        reactions.toggle(roomId, messageId, CurrentUser.id(authentication), input.emoji());
    }
}
