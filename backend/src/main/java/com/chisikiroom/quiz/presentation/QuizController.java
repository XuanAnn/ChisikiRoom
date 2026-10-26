package com.chisikiroom.quiz.presentation;

import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.quiz.application.QuizService;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/question-sets")
public class QuizController {

    private final QuizService quizzes;

    public QuizController(QuizService quizzes) {
        this.quizzes = quizzes;
    }

    @GetMapping
    public List<QuizService.Quiz> list(Authentication auth) {
        return quizzes.list(CurrentUser.id(auth));
    }

    @GetMapping("/{id}")
    public QuizService.Quiz read(Authentication auth, @PathVariable UUID id) {
        return quizzes.get(id, CurrentUser.id(auth));
    }

    @PostMapping
    public QuizService.Quiz create(
        Authentication auth,
        @Valid @RequestBody QuizService.Input input
    ) {
        return quizzes.create(CurrentUser.id(auth), input);
    }

    @PutMapping("/{id}")
    public QuizService.Quiz update(
        Authentication auth,
        @PathVariable UUID id,
        @Valid @RequestBody QuizService.Input input
    ) {
        return quizzes.update(CurrentUser.id(auth), id, input);
    }
}
