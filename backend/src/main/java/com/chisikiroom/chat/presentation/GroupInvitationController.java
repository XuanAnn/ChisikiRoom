package com.chisikiroom.chat.presentation;

import com.chisikiroom.chat.application.ChatService;
import com.chisikiroom.common.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/group-invitations")
public class GroupInvitationController {

    private final ChatService chat;

    public GroupInvitationController(ChatService chat) {
        this.chat = chat;
    }

    public record ResponseInput(@NotNull Boolean accept) {}

    @GetMapping
    public List<ChatService.GroupInvitation> list(Authentication auth) {
        return chat.invitations(CurrentUser.id(auth));
    }

    @PostMapping("/{roomId}/respond")
    public void respond(
        Authentication auth,
        @PathVariable UUID roomId,
        @Valid @RequestBody ResponseInput input
    ) {
        chat.respondInvitation(roomId, CurrentUser.id(auth), input.accept());
    }
}
