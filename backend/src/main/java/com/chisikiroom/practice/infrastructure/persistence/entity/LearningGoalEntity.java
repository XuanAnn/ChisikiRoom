package com.chisikiroom.practice.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "learning_goals")
public class LearningGoalEntity {

    @Id
    @Column(name = "user_id")
    public UUID userId;

    @Column(name = "daily_questions", nullable = false)
    public int dailyQuestions;
}
