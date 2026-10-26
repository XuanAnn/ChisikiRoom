package com.chisikiroom.practice.application;

import com.chisikiroom.practice.infrastructure.persistence.entity.PracticeAttemptEntity;
import com.chisikiroom.practice.infrastructure.persistence.repository.PracticeAttemptRepository;
import com.chisikiroom.quiz.application.QuizService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class PracticeService {

    private final PracticeAttemptRepository attempts;
    private final QuizService quizzes;
    private final ObjectMapper json;
    private final Clock clock;

    public PracticeService(
        PracticeAttemptRepository attempts,
        QuizService quizzes,
        ObjectMapper json,
        Clock clock
    ) {
        this.attempts = attempts;
        this.quizzes = quizzes;
        this.json = json;
        this.clock = clock;
    }

    public record StartInput(@NotNull UUID questionSetId) {}

    public record AnswersInput(
        @NotNull @Size(min = 1, max = 100) List<@NotNull @Min(-1) @Max(5) Integer> answers
    ) {}

    public record QuestionView(
        String text,
        List<String> options,
        Integer correctIndex,
        String explanation
    ) {}

    public record Attempt(
        UUID id,
        UUID questionSetId,
        String title,
        List<QuestionView> questions,
        List<Integer> answers,
        Integer correctCount,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt
    ) {}

    public record HistoryItem(
        UUID id,
        UUID questionSetId,
        String title,
        int questionCount,
        Integer correctCount,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt
    ) {}

    private PracticeAttemptEntity owned(UUID id, UUID userId) {
        return attempts
            .findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private String encode(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot encode practice data", exception);
        }
    }

    private List<Integer> decodeAnswers(String value) {
        try {
            return json.readValue(value, new TypeReference<List<Integer>>() {});
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot decode practice answers", exception);
        }
    }

    private Attempt view(PracticeAttemptEntity attempt) {
        boolean completed = attempt.finishedAt != null;
        List<QuestionView> questions = quizzes
            .decode(attempt.questionSnapshot)
            .stream()
            .map(question -> {
                Integer correctIndex = null;
                String explanation = null;
                if (completed) {
                    correctIndex = question.correctIndex();
                    explanation = question.explanation();
                }
                return new QuestionView(
                    question.text(),
                    question.options(),
                    correctIndex,
                    explanation
                );
            })
            .toList();
        Integer correctCount = null;
        if (completed) {
            correctCount = attempt.correctCount;
        }
        return new Attempt(
            attempt.id,
            attempt.questionSetId,
            attempt.title,
            questions,
            decodeAnswers(attempt.answers),
            correctCount,
            attempt.startedAt,
            attempt.finishedAt
        );
    }

    public Attempt get(UUID userId, UUID id) {
        return view(owned(id, userId));
    }

    public List<HistoryItem> history(UUID userId) {
        return attempts
            .findTop50ByUserIdOrderByStartedAtDesc(userId)
            .stream()
            .map(attempt -> {
                Integer correctCount = null;
                if (attempt.finishedAt != null) {
                    correctCount = attempt.correctCount;
                }
                return new HistoryItem(
                    attempt.id,
                    attempt.questionSetId,
                    attempt.title,
                    attempt.questionCount,
                    correctCount,
                    attempt.startedAt,
                    attempt.finishedAt
                );
            })
            .toList();
    }

    @Transactional
    public Attempt start(UUID userId, UUID questionSetId) {
        QuizService.Quiz quiz = quizzes.get(questionSetId, userId);
        return create(userId, questionSetId, quiz.title(), quiz.questions());
    }

    @Transactional
    public Attempt retryMistakes(UUID userId, UUID previousId) {
        PracticeAttemptEntity previous = owned(previousId, userId);
        if (previous.finishedAt == null) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Hãy nộp bài trước khi ôn câu sai"
            );
        }
        List<QuizService.Question> previousQuestions = quizzes.decode(previous.questionSnapshot);
        List<Integer> previousAnswers = decodeAnswers(previous.answers);
        List<QuizService.Question> mistakes = new ArrayList<>();
        for (int index = 0; index < previousQuestions.size(); index++) {
            QuizService.Question question = previousQuestions.get(index);
            if (previousAnswers.get(index) != question.correctIndex()) {
                mistakes.add(question);
            }
        }
        if (mistakes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài này không có câu sai");
        }
        return create(userId, previous.questionSetId, previous.title, mistakes);
    }

    private Attempt create(
        UUID userId,
        UUID questionSetId,
        String title,
        List<QuizService.Question> questions
    ) {
        PracticeAttemptEntity attempt = new PracticeAttemptEntity();
        attempt.id = UUID.randomUUID();
        attempt.userId = userId;
        attempt.questionSetId = questionSetId;
        attempt.title = title;
        attempt.questionSnapshot = encode(questions);
        attempt.answers = encode(Collections.nCopies(questions.size(), -1));
        attempt.questionCount = questions.size();
        attempt.startedAt = OffsetDateTime.now(clock);
        return view(attempts.save(attempt));
    }

    @Transactional
    public Attempt save(UUID userId, UUID id, List<Integer> answers, boolean submit) {
        PracticeAttemptEntity attempt = attempts
            .lockOwned(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // A submitted attempt is immutable. Repeated requests return the same result.
        if (attempt.finishedAt != null) {
            return view(attempt);
        }
        List<QuizService.Question> questions = quizzes.decode(attempt.questionSnapshot);
        if (answers.size() != questions.size()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Số đáp án không khớp số câu hỏi"
            );
        }
        int correctCount = 0;
        for (int index = 0; index < questions.size(); index++) {
            Integer answer = answers.get(index);
            QuizService.Question question = questions.get(index);
            if (answer == null || answer < -1 || answer >= question.options().size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đáp án không hợp lệ");
            }
            if (answer == question.correctIndex()) {
                correctCount++;
            }
        }
        attempt.answers = encode(answers);
        if (submit) {
            attempt.correctCount = correctCount;
            attempt.finishedAt = OffsetDateTime.now(clock);
        }
        return view(attempt);
    }
}
