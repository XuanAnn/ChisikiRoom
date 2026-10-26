package com.chisikiroom.ranking.presentation;

import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.ranking.application.RankingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ranking")
public class RankingController {

    private final RankingService ranking;

    public RankingController(RankingService ranking) {
        this.ranking = ranking;
    }

    public record QueueInput(@NotNull @Pattern(regexp = "N5|N4") String level) {}

    @GetMapping
    public RankingService.Board board(
        Authentication auth,
        @RequestParam(defaultValue = "N5") String level
    ) {
        return ranking.board(CurrentUser.id(auth), level);
    }

    @GetMapping("/queue")
    public RankingService.QueueState state(Authentication auth) {
        return ranking.state(CurrentUser.id(auth));
    }

    @PostMapping("/queue")
    public RankingService.QueueState join(
        Authentication auth,
        @Valid @RequestBody QueueInput input
    ) {
        return ranking.join(CurrentUser.id(auth), input.level());
    }

    @PostMapping("/queue/heartbeat")
    public RankingService.QueueState heartbeat(Authentication auth) {
        return ranking.heartbeat(CurrentUser.id(auth));
    }

    @DeleteMapping("/queue")
    public RankingService.QueueState cancel(Authentication auth) {
        return ranking.cancel(CurrentUser.id(auth));
    }

    @GetMapping("/history")
    public List<RankingService.MatchView> history(Authentication auth) {
        return ranking.history(CurrentUser.id(auth));
    }
}
