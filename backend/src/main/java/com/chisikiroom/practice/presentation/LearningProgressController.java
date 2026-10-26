package com.chisikiroom.practice.presentation;

import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.practice.application.LearningProgressService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/learning-progress")
public class LearningProgressController {

    private final LearningProgressService progress;

    public LearningProgressController(LearningProgressService progress) {
        this.progress = progress;
    }

    @GetMapping
    public LearningProgressService.Progress get(Authentication auth) {
        return progress.get(CurrentUser.id(auth));
    }

    @PutMapping("/goal")
    public LearningProgressService.Progress update(
        Authentication auth,
        @Valid @RequestBody LearningProgressService.GoalInput input
    ) {
        return progress.updateGoal(CurrentUser.id(auth), input.dailyQuestions());
    }
}
