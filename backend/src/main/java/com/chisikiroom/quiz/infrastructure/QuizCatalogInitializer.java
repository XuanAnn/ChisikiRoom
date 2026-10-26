package com.chisikiroom.quiz.infrastructure;

import com.chisikiroom.quiz.application.QuizService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class QuizCatalogInitializer implements ApplicationRunner {

    private final QuizService quizzes;
    private final ObjectMapper json;
    private final Validator validator;

    public QuizCatalogInitializer(QuizService quizzes, ObjectMapper json, Validator validator) {
        this.quizzes = quizzes;
        this.json = json;
        this.validator = validator;
    }

    @Override
    public void run(ApplicationArguments arguments) throws Exception {
        List<QuizService.CatalogEntry> entries;
        ClassPathResource resource = new ClassPathResource("quiz/japanese-n5-n4.json");
        try (var input = resource.getInputStream()) {
            entries = json.readValue(input, new TypeReference<List<QuizService.CatalogEntry>>() {});
        }
        HashSet<UUID> ids = new HashSet<>();
        for (QuizService.CatalogEntry entry : entries) {
            if (!validator.validate(entry).isEmpty() || !ids.add(entry.id())) {
                throw new IllegalStateException(
                    "Invalid or duplicate built-in quiz: " + entry.id()
                );
            }
        }
        quizzes.installCatalog(entries);
    }
}
