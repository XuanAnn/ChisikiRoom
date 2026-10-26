package com.chisikiroom.battle.presentation;

import com.chisikiroom.battle.application.BattleService;
import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.realtime.application.Events;
import com.chisikiroom.realtime.application.IceServers;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/battles/{id}")
public class MediaController {

    private final BattleService battles;
    private final Events events;
    private final IceServers ice;

    public MediaController(BattleService battles, Events events, IceServers ice) {
        this.battles = battles;
        this.events = events;
        this.ice = ice;
    }

    public record Signal(
        @NotNull UUID targetId,
        @Pattern(regexp = "offer|answer|ice|restart") @NotNull String kind,
        @NotNull JsonNode payload
    ) {}

    private void requireActive(UUID battle, UUID user) {
        if (
            battles
                .players(battle)
                .stream()
                .noneMatch(p -> p.id().equals(user) && p.status().equals("ACTIVE"))
        ) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Bạn không có quyền truyền media trong trận"
            );
        }
    }

    @PostMapping("/signal")
    public void signal(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody Signal signal
    ) {
        UUID user = CurrentUser.id(auth);
        requireActive(id, user);
        requireActive(id, signal.targetId());
        if (signal.payload().toString().length() > 32000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signaling quá lớn");
        }
        events.send(
            List.of(signal.targetId()),
            "MEDIA_SIGNAL",
            Map.of(
                "battleId",
                id,
                "senderId",
                user,
                "kind",
                signal.kind(),
                "payload",
                signal.payload()
            )
        );
    }

    @GetMapping("/ice-servers")
    public Map<String, Object> ice(Authentication auth, @PathVariable UUID id) {
        UUID user = CurrentUser.id(auth);
        requireActive(id, user);
        return ice.forUser(user);
    }
}
