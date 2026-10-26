package com.chisikiroom.quiz.application;

import com.chisikiroom.quiz.infrastructure.persistence.entity.QuestionSetEntity;
import com.chisikiroom.quiz.infrastructure.persistence.repository.QuestionSetRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class QuizService {

    private final ObjectMapper json;
    private final QuestionSetRepository quizzes;

    public QuizService(ObjectMapper json, QuestionSetRepository quizzes) {
        this.json = json;
        this.quizzes = quizzes;
    }

    public record Question(
        @NotBlank @Size(max = 2000) String text,
        @NotNull @Size(min = 2, max = 6) List<@NotBlank @Size(max = 500) String> options,
        @Min(0) @Max(5) int correctIndex,
        @Size(max = 2000) String explanation
    ) {}

    public record Input(
        @NotBlank @Size(max = 120) String title,
        @NotNull @Size(min = 1, max = 100) List<@NotNull @Valid Question> questions
    ) {}

    public record Quiz(
        UUID id,
        UUID ownerId,
        String title,
        List<Question> questions,
        OffsetDateTime updatedAt
    ) {}

    public List<Question> decode(String value) {
        try {
            return json.readValue(value, new TypeReference<List<Question>>() {});
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private Quiz view(QuestionSetEntity questionSetEntity) {
        return new Quiz(
            questionSetEntity.id,
            questionSetEntity.ownerId,
            questionSetEntity.title,
            decode(questionSetEntity.questions),
            questionSetEntity.updatedAt
        );
    }

    private QuestionSetEntity owned(UUID id, UUID owner) {
        return quizzes
            .findByIdAndOwnerId(id, owner)
            .orElseThrow(() ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy bộ câu hỏi của bạn"
                )
            );
    }

    public Quiz get(UUID id, UUID owner) {
        return quizzes
            .findVisibleById(id, owner)
            .map(this::view)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bộ câu hỏi")
            );
    }

    public UUID owner(UUID id) {
        return quizzes
            .findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND))
            .ownerId;
    }

    public List<Quiz> list(UUID owner) {
        return quizzes.findVisible(owner).stream().map(this::view).toList();
    }

    public record CatalogEntry(@NotNull UUID id, @NotNull @Valid Input quiz) {}

    @Transactional
    public void installCatalog(List<CatalogEntry> entries) {
        for (CatalogEntry entry : entries) {
            Optional<QuestionSetEntity> existing = quizzes.findById(entry.id());
            if (existing.isPresent()) {
                fillMissingExplanations(existing.get(), entry.quiz());
                continue;
            }
            QuestionSetEntity questionSet = new QuestionSetEntity();
            questionSet.id = entry.id();
            questionSet.ownerId = null;
            apply(questionSet, entry.quiz());
            quizzes.save(questionSet);
        }
    }

    private void fillMissingExplanations(QuestionSetEntity existing, Input catalog) {
        if (existing.ownerId != null) {
            return;
        }
        List<Question> current = decode(existing.questions);
        if (current.size() != catalog.questions().size()) {
            return;
        }
        List<Question> updated = new ArrayList<>(current);
        boolean changed = false;
        for (int index = 0; index < current.size(); index++) {
            Question question = current.get(index);
            Question source = catalog.questions().get(index);
            boolean missingExplanation =
                question.explanation() == null || question.explanation().isBlank();
            boolean sameQuestion =
                question.text().equals(source.text()) &&
                question.options().equals(source.options()) &&
                question.correctIndex() == source.correctIndex();
            if (missingExplanation && sameQuestion && source.explanation() != null) {
                updated.set(index, source);
                changed = true;
            }
        }
        if (changed) {
            try {
                existing.questions = json.writeValueAsString(updated);
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        }
    }

    @Transactional
    public Quiz create(UUID owner, Input input) {
        var questionSetEntity = new QuestionSetEntity();
        questionSetEntity.id = UUID.randomUUID();
        questionSetEntity.ownerId = owner;
        apply(questionSetEntity, input);
        return view(quizzes.save(questionSetEntity));
    }

    @Transactional
    public Quiz update(UUID owner, UUID id, Input input) {
        var questionSetEntity = owned(id, owner);
        apply(questionSetEntity, input);
        return view(questionSetEntity);
    }

    private void apply(QuestionSetEntity questionSetEntity, Input input) {
        if (
            input
                .questions()
                .stream()
                .anyMatch(
                    item -> item.options() == null || item.correctIndex() >= item.options().size()
                )
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Đáp án đúng không nằm trong các phương án"
            );
        }
        questionSetEntity.title = input.title().strip();
        questionSetEntity.updatedAt = OffsetDateTime.now();
        try {
            questionSetEntity.questions = json.writeValueAsString(input.questions());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
