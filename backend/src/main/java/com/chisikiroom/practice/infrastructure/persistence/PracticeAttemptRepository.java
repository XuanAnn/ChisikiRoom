package com.chisikiroom.practice.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface PracticeAttemptRepository extends JpaRepository<PracticeAttemptEntity, UUID> {
    Optional<PracticeAttemptEntity> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        "select attempt from PracticeAttemptEntity attempt where attempt.id = :id and attempt.userId = :userId"
    )
    Optional<PracticeAttemptEntity> lockOwned(@Param("id") UUID id, @Param("userId") UUID userId);

    interface Totals {
        Long getAttemptCount();
        Long getQuestionCount();
        Long getCorrectCount();
    }

    @Query(
        "select count(attempt) as attemptCount, coalesce(sum(attempt.questionCount), 0) as questionCount, coalesce(sum(attempt.correctCount), 0) as correctCount from PracticeAttemptEntity attempt where attempt.userId = :userId and attempt.finishedAt is not null"
    )
    Totals totals(@Param("userId") UUID userId);

    @Query(
        "select attempt.answers from PracticeAttemptEntity attempt where attempt.userId = :userId and attempt.finishedAt >= :start and attempt.finishedAt < :end"
    )
    List<String> answersBetween(
        @Param("userId") UUID userId,
        @Param("start") OffsetDateTime start,
        @Param("end") OffsetDateTime end
    );

    List<PracticeAttemptEntity> findTop50ByUserIdOrderByStartedAtDesc(UUID userId);
}
