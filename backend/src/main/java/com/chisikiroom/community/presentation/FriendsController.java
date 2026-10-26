package com.chisikiroom.community.presentation;

import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.community.application.FriendsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class FriendsController {

    private final FriendsService friends;

    public FriendsController(FriendsService friends) {
        this.friends = friends;
    }

    public record Invite(@NotNull UUID userId) {}

    public record Decision(@NotNull UUID senderId, boolean accept) {}

    @GetMapping("/users")
    public List<FriendsService.Person> search(
        @RequestParam(name = "q", defaultValue = "") String query
    ) {
        return friends.search(query);
    }

    @GetMapping("/friends")
    public List<FriendsService.Person> friends(Authentication authentication) {
        return friends.listFriends(CurrentUser.id(authentication));
    }

    @GetMapping("/friend-requests")
    public List<FriendsService.Invitation> invitations(Authentication authentication) {
        return friends.invitations(CurrentUser.id(authentication));
    }

    @PostMapping("/friend-requests")
    public void invite(Authentication authentication, @Valid @RequestBody Invite input) {
        friends.invite(CurrentUser.id(authentication), input.userId());
    }

    @PostMapping("/friend-requests/respond")
    public void decide(Authentication authentication, @Valid @RequestBody Decision decision) {
        friends.respond(CurrentUser.id(authentication), decision.senderId(), decision.accept());
    }
}
