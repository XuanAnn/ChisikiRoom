package com.chisikiroom.practice.presentation;

import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.practice.application.PracticeService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/practice")
public class PracticeController {

    private final PracticeService practice;

    public PracticeController(PracticeService practice) {
        this.practice = practice;
    }

    @GetMapping
    public List<PracticeService.HistoryItem> history(Authentication auth) {
        return practice.history(CurrentUser.id(auth));
    }

    @PostMapping
    public PracticeService.Attempt start(
        Authentication auth,
        @Valid @RequestBody PracticeService.StartInput input
    ) {
        return practice.start(CurrentUser.id(auth), input.questionSetId());
    }

    @GetMapping("/{id}")
    public PracticeService.Attempt get(Authentication auth, @PathVariable UUID id) {
        return practice.get(CurrentUser.id(auth), id);
    }

    @PutMapping("/{id}/answers")
    public PracticeService.Attempt save(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody PracticeService.AnswersInput input
    ) {
        return practice.save(CurrentUser.id(auth), id, input.answers(), false);
    }

    @PostMapping("/{id}/submit")
    public PracticeService.Attempt submit(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody PracticeService.AnswersInput input
    ) {
        return practice.save(CurrentUser.id(auth), id, input.answers(), true);
    }

    @PostMapping("/{id}/mistakes")
    public PracticeService.Attempt retry(Authentication auth, @PathVariable UUID id) {
        return practice.retryMistakes(CurrentUser.id(auth), id);
    }
}
