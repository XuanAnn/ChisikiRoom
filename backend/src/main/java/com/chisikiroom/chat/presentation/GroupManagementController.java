package com.chisikiroom.chat.presentation;

import com.chisikiroom.chat.application.GroupService;
import com.chisikiroom.common.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/groups/{id}")
public class GroupManagementController {

    private final GroupService groups;

    public GroupManagementController(GroupService groups) {
        this.groups = groups;
    }

    public record Info(@NotBlank @Size(max = 80) String name, @NotNull Boolean privateRoom) {}

    public record Role(
        @NotNull UUID userId,
        @NotNull @Pattern(regexp = "ADMIN|MEMBER") String role
    ) {}

    public record UserInput(@NotNull UUID userId) {}

    public record Removal(@NotNull UUID userId, boolean block) {}

    @PutMapping
    public void update(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Info input) {
        groups.update(id, CurrentUser.id(auth), input.name(), input.privateRoom());
    }

    @PutMapping("/role")
    public void role(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Role input) {
        groups.role(id, CurrentUser.id(auth), input.userId(), input.role());
    }

    @PostMapping("/transfer")
    public void transfer(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody UserInput input
    ) {
        groups.transfer(id, CurrentUser.id(auth), input.userId());
    }

    @PostMapping("/remove")
    public void remove(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody Removal input
    ) {
        groups.remove(id, CurrentUser.id(auth), input.userId(), input.block());
    }

    @GetMapping("/bans")
    public List<GroupService.Ban> bans(Authentication auth, @PathVariable UUID id) {
        return groups.bans(id, CurrentUser.id(auth));
    }

    @PostMapping("/unblock")
    public void unblock(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody UserInput input
    ) {
        groups.unblock(id, CurrentUser.id(auth), input.userId());
    }
}
