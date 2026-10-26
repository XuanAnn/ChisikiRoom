package com.chisikiroom.ranking.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ranked_questions")
public class RankedQuestionEntity {

    @Id
    public UUID id;

    @Column(nullable = false, length = 2)
    public String level;

    @Column(nullable = false, columnDefinition = "text")
    public String content;
}
