package com.chisikiroom.calling.presentation;

import com.chisikiroom.calling.application.CallService;
import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.realtime.application.IceServers;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class CallController {

    private final CallService calls;
    private final IceServers ice;

    public CallController(CallService calls, IceServers ice) {
        this.calls = calls;
        this.ice = ice;
    }

    public record Heartbeat(boolean camera) {}

    public record Signal(
        @NotNull UUID targetId,
        @NotNull @Pattern(regexp = "offer|answer|ice|restart") String kind,
        @NotNull JsonNode payload
    ) {}

    @GetMapping("/chat-rooms/{id}/call")
    public CallService.View current(Authentication auth, @PathVariable UUID id) {
        return calls.current(id, CurrentUser.id(auth));
    }

    @PostMapping("/chat-rooms/{id}/call")
    public CallService.View start(Authentication auth, @PathVariable UUID id) {
        return calls.start(id, CurrentUser.id(auth));
    }

    @GetMapping("/calls/{id}")
    public CallService.View get(Authentication auth, @PathVariable UUID id) {
        return calls.get(id, CurrentUser.id(auth));
    }

    @PostMapping("/calls/{id}/join")
    public CallService.View join(Authentication auth, @PathVariable UUID id) {
        return calls.join(id, CurrentUser.id(auth));
    }

    @PostMapping("/calls/{id}/heartbeat")
    public CallService.View heartbeat(
        Authentication auth,
        @PathVariable UUID id,
        @RequestBody Heartbeat input
    ) {
        return calls.heartbeat(id, CurrentUser.id(auth), input.camera());
    }

    @PostMapping("/calls/{id}/leave")
    public void leave(Authentication auth, @PathVariable UUID id) {
        calls.leave(id, CurrentUser.id(auth));
    }

    @PostMapping("/calls/{id}/decline")
    public void decline(Authentication auth, @PathVariable UUID id) {
        calls.decline(id, CurrentUser.id(auth));
    }

    @GetMapping("/calls/{id}/ice-servers")
    public Map<String, Object> ice(Authentication auth, @PathVariable UUID id) {
        UUID user = CurrentUser.id(auth);
        calls.requireMedia(id, user);
        return ice.forUser(user);
    }

    @PostMapping("/calls/{id}/signal")
    public void signal(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody Signal signal
    ) {
        if (signal.payload().toString().length() > 32000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signaling quá lớn");
        }
        calls.signal(id, CurrentUser.id(auth), signal.targetId(), signal.kind(), signal.payload());
    }
}
