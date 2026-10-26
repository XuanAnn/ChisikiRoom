package com.chisikiroom.ranking.infrastructure;

import com.chisikiroom.ranking.application.RankingService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class RankingBankInitializer implements ApplicationRunner {

    private final RankingService ranking;
    private final ObjectMapper json;
    private final Validator validator;

    public RankingBankInitializer(RankingService ranking, ObjectMapper json, Validator validator) {
        this.ranking = ranking;
        this.json = json;
        this.validator = validator;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        List<RankingService.BankEntry> entries;
        try (var input = new ClassPathResource("ranking/japanese-ranked.json").getInputStream()) {
            entries = json.readValue(input, new TypeReference<List<RankingService.BankEntry>>() {});
        }
        Set<UUID> ids = new HashSet<>();
        for (var entry : entries) {
            if (
                entry.id() == null ||
                !ids.add(entry.id()) ||
                entry.question() == null ||
                !validator.validate(entry.question()).isEmpty() ||
                entry.question().correctIndex() >= entry.question().options().size()
            ) {
                throw new IllegalStateException("Invalid ranked question bank");
            }
        }
        ranking.installBank(entries);
    }
}
