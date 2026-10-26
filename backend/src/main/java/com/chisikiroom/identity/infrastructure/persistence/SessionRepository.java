package com.chisikiroom.identity.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessionRepository extends JpaRepository<UserSessionEntity, String> {
    @Query(
        """
        select user from UserEntity user, UserSessionEntity session
        where session.userId = user.id and session.tokenHash = :tokenHash
          and session.expiresAt > :now
        """
    )
    Optional<UserEntity> findActiveUser(
        @Param("tokenHash") String tokenHash,
        @Param("now") OffsetDateTime now
    );
}
