package com.chisikiroom.quiz.infrastructure.persistence.repository;

import com.chisikiroom.quiz.infrastructure.persistence.entity.QuestionSetEntity;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuestionSetRepository extends JpaRepository<QuestionSetEntity, UUID> {
    Optional<QuestionSetEntity> findByIdAndOwnerId(UUID id, UUID ownerId);

    @Query(
        "select quiz from QuestionSetEntity quiz where quiz.ownerId = :ownerId or quiz.ownerId is null order by quiz.updatedAt desc, quiz.id asc"
    )
    List<QuestionSetEntity> findVisible(@Param("ownerId") UUID ownerId);

    @Query(
        "select quiz from QuestionSetEntity quiz where quiz.id = :id and (quiz.ownerId = :ownerId or quiz.ownerId is null)"
    )
    Optional<QuestionSetEntity> findVisibleById(
        @Param("id") UUID id,
        @Param("ownerId") UUID ownerId
    );
}
