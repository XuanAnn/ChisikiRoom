package com.chisikiroom.practice.infrastructure.persistence;

import jakarta.persistence.LockModeType;
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

    List<PracticeAttemptEntity> findTop50ByUserIdOrderByStartedAtDesc(UUID userId);
}
