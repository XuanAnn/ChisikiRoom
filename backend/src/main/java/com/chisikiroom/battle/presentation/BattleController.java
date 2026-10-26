package com.chisikiroom.battle.presentation;

import com.chisikiroom.battle.application.BattleService;
import com.chisikiroom.common.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/battles")
public class BattleController {

    private final BattleService battles;

    public BattleController(BattleService battles) {
        this.battles = battles;
    }

    public record Create(@NotNull UUID roomId, @NotNull UUID questionSetId) {}

    public record State(boolean camera, boolean ready) {}

    public record Answer(
        @NotNull UUID roundId,
        @Min(0) @Max(5) int optionIndex,
        @NotNull UUID requestId
    ) {}

    @GetMapping
    public List<BattleService.Snapshot> list(Authentication auth, @RequestParam UUID roomId) {
        return battles.list(roomId, CurrentUser.id(auth));
    }

    @PostMapping
    public BattleService.Snapshot create(Authentication auth, @Valid @RequestBody Create input) {
        return battles.create(input.roomId(), input.questionSetId(), CurrentUser.id(auth));
    }

    @GetMapping("/{id}")
    public BattleService.Snapshot get(Authentication auth, @PathVariable UUID id) {
        return battles.snapshot(id, CurrentUser.id(auth));
    }

    @GetMapping("/{id}/results")
    public BattleService.Snapshot results(Authentication auth, @PathVariable UUID id) {
        return battles.snapshot(id, CurrentUser.id(auth));
    }

    @PostMapping("/{id}/join")
    public BattleService.Snapshot join(Authentication auth, @PathVariable UUID id) {
        return battles.join(id, CurrentUser.id(auth));
    }

    @PostMapping("/{id}/heartbeat")
    public BattleService.Snapshot heartbeat(
        Authentication auth,
        @PathVariable UUID id,
        @RequestBody State state
    ) {
        return battles.heartbeat(id, CurrentUser.id(auth), state.camera(), state.ready());
    }

    @PostMapping("/{id}/start")
    public BattleService.Snapshot start(Authentication auth, @PathVariable UUID id) {
        return battles.start(id, CurrentUser.id(auth));
    }

    @PostMapping("/{id}/leave")
    public BattleService.Snapshot leave(Authentication auth, @PathVariable UUID id) {
        return battles.leave(id, CurrentUser.id(auth));
    }

    @PostMapping("/{id}/answers")
    public BattleService.Snapshot answer(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody Answer answer
    ) {
        return battles.answer(
            id,
            CurrentUser.id(auth),
            answer.roundId(),
            answer.optionIndex(),
            answer.requestId()
        );
    }
}
