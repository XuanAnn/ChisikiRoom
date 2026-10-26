package com.chisikiroom.practice.application;

import com.chisikiroom.practice.infrastructure.persistence.repository.LearningRepository;
import com.chisikiroom.practice.infrastructure.persistence.repository.PracticeAttemptRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LearningProgressService {

    private static final ZoneId LEARNING_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final LearningRepository learning;
    private final PracticeAttemptRepository attempts;
    private final Clock clock;
    private final ObjectMapper json;

    public LearningProgressService(
        LearningRepository learning,
        PracticeAttemptRepository attempts,
        Clock clock,
        ObjectMapper json
    ) {
        this.learning = learning;
        this.attempts = attempts;
        this.clock = clock;
        this.json = json;
    }

    public record GoalInput(@Min(1) @Max(200) int dailyQuestions) {}

    public record Progress(
        long completedAttempts,
        long totalQuestions,
        long correctAnswers,
        double accuracy,
        long todayAnswered,
        int dailyGoal,
        LocalDate date,
        String timezone
    ) {}

    public Progress get(UUID userId) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), LEARNING_ZONE);
        OffsetDateTime start = today.atStartOfDay(LEARNING_ZONE).toOffsetDateTime();
        OffsetDateTime end = today.plusDays(1).atStartOfDay(LEARNING_ZONE).toOffsetDateTime();
        PracticeAttemptRepository.Totals totals = attempts.totals(userId);
        int goal = learning
            .findGoal(userId)
            .map(value -> value.dailyQuestions)
            .orElse(20);
        double accuracy = 0;
        if (totals.getQuestionCount() > 0) {
            accuracy =
                Math.round((1000.0 * totals.getCorrectCount()) / totals.getQuestionCount()) / 10.0;
        }
        return new Progress(
            totals.getAttemptCount(),
            totals.getQuestionCount(),
            totals.getCorrectCount(),
            accuracy,
            todayAnswered(userId, start, end),
            goal,
            today,
            LEARNING_ZONE.getId()
        );
    }

    private long todayAnswered(UUID userId, OffsetDateTime start, OffsetDateTime end) {
        long answered = 0;
        for (String value : attempts.answersBetween(userId, start, end)) {
            try {
                for (JsonNode answer : json.readTree(value)) {
                    if (answer.asInt() >= 0) {
                        answered++;
                    }
                }
            } catch (Exception exception) {
                throw new IllegalStateException("Cannot read learning progress", exception);
            }
        }
        return answered;
    }

    @Transactional
    public Progress updateGoal(UUID userId, int dailyQuestions) {
        if (dailyQuestions < 1 || dailyQuestions > 200) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Mục tiêu từ 1 đến 200 câu mỗi ngày"
            );
        }
        learning.saveGoal(userId, dailyQuestions);
        return get(userId);
    }
}
