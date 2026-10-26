package com.chisikiroom.quiz.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "question_sets")
public class QuestionSetEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "owner_id")
    public UUID ownerId;

    @Column(name = "title", nullable = false, length = 120)
    public String title;

    @Column(name = "questions", nullable = false, columnDefinition = "text")
    public String questions;

    @Column(name = "updated_at", nullable = false)
    public OffsetDateTime updatedAt = OffsetDateTime.now();
}
