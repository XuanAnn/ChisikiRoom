package com.chisikiroom.practice.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "practice_attempts")
public class PracticeAttemptEntity {

    @Id
    public UUID id;

    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "question_set_id", nullable = false)
    public UUID questionSetId;

    @Column(nullable = false, length = 120)
    public String title;

    @Column(name = "question_snapshot", nullable = false, columnDefinition = "text")
    public String questionSnapshot;

    @Column(nullable = false, columnDefinition = "text")
    public String answers;

    @Column(name = "correct_count", nullable = false)
    public int correctCount;

    @Column(name = "question_count", nullable = false)
    public int questionCount;

    @Column(name = "started_at", nullable = false)
    public OffsetDateTime startedAt;

    @Column(name = "finished_at")
    public OffsetDateTime finishedAt;
}
