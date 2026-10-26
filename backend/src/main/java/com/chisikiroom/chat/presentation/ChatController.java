package com.chisikiroom.chat.presentation;

import com.chisikiroom.chat.application.ChatService;
import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.identity.application.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat-rooms")
public class ChatController {

    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    public record Create(@NotBlank @Size(max = 80) String name, boolean privateRoom) {}

    public record Send(
        @NotBlank @Size(max = 4000) String content,
        @NotNull UUID requestId,
        @Positive Long replyToId
    ) {}

    public record Invite(@NotNull UUID userId) {}

    @PostMapping("/direct")
    public ChatService.Room direct(Authentication auth, @Valid @RequestBody Invite input) {
        return chat.direct(CurrentUser.id(auth), input.userId());
    }

    @GetMapping
    public List<ChatService.Room> list(Authentication auth) {
        return chat.rooms(CurrentUser.id(auth));
    }

    @PostMapping
    public ChatService.Room create(Authentication auth, @Valid @RequestBody Create input) {
        return chat.create(CurrentUser.id(auth), input.name(), input.privateRoom());
    }

    @PostMapping("/{id}/join")
    public void join(Authentication auth, @PathVariable UUID id) {
        chat.join(id, CurrentUser.id(auth));
    }

    @PostMapping("/{id}/leave")
    public void leave(Authentication auth, @PathVariable UUID id) {
        chat.leave(id, CurrentUser.id(auth));
    }

    @PostMapping("/{id}/invite")
    public void invite(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody Invite input
    ) {
        chat.invite(id, CurrentUser.id(auth), input.userId());
    }

    @GetMapping("/{id}/members")
    public List<ChatService.Member> members(Authentication auth, @PathVariable UUID id) {
        return chat.members(id, CurrentUser.id(auth));
    }

    @GetMapping("/{id}/messages")
    public List<ChatService.ChatMessage> history(
        Authentication auth,
        @PathVariable UUID id,
        @RequestParam(defaultValue = "9223372036854775807") long before
    ) {
        return chat.history(id, CurrentUser.id(auth), before);
    }

    @PostMapping("/{id}/messages")
    public ChatService.ChatMessage send(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody Send input
    ) {
        return chat.post(
            id,
            CurrentUser.id(auth),
            input.content(),
            input.requestId(),
            input.replyToId()
        );
    }

    public record DraftInput(
        @NotNull @Size(max = 4000) String content,
        @NotNull @PositiveOrZero Long version
    ) {}

    public record ReadInput(@NotNull @PositiveOrZero Long lastReadId) {}

    @GetMapping("/state")
    public List<ChatService.State> states(Authentication auth) {
        return chat.states(CurrentUser.id(auth));
    }

    @PutMapping("/{id}/state/draft")
    public ChatService.State draft(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody DraftInput input
    ) {
        return chat.saveDraft(id, CurrentUser.id(auth), input.content(), input.version());
    }

    @PutMapping("/{id}/state/read")
    public ChatService.State read(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody ReadInput input
    ) {
        return chat.markRead(id, CurrentUser.id(auth), input.lastReadId());
    }

    public record EditInput(@NotBlank @Size(max = 4000) String content) {}

    public record PinInput(@NotNull Boolean pinned) {}

    @PutMapping("/{id}/messages/{messageId}")
    public ChatService.ChatMessage edit(
        Authentication auth,
        @PathVariable UUID id,
        @PathVariable long messageId,
        @Valid @RequestBody EditInput input
    ) {
        return chat.edit(id, CurrentUser.id(auth), messageId, input.content());
    }

    @DeleteMapping("/{id}/messages/{messageId}")
    public ChatService.ChatMessage delete(
        Authentication auth,
        @PathVariable UUID id,
        @PathVariable long messageId
    ) {
        return chat.delete(id, CurrentUser.id(auth), messageId);
    }

    @PutMapping("/{id}/messages/{messageId}/pin")
    public ChatService.ChatMessage pin(
        Authentication auth,
        @PathVariable UUID id,
        @PathVariable long messageId,
        @Valid @RequestBody PinInput input
    ) {
        return chat.pin(id, CurrentUser.id(auth), messageId, input.pinned());
    }

    @GetMapping("/{id}/pinned")
    public List<ChatService.ChatMessage> pinned(Authentication auth, @PathVariable UUID id) {
        return chat.pinned(id, CurrentUser.id(auth));
    }

    @GetMapping("/{id}/messages/search")
    public List<ChatService.ChatMessage> search(
        Authentication authentication,
        @PathVariable UUID id,
        @RequestParam String q,
        @RequestParam(defaultValue = "9223372036854775807") long before
    ) {
        return chat.search(id, CurrentUser.id(authentication), q, before);
    }
}
