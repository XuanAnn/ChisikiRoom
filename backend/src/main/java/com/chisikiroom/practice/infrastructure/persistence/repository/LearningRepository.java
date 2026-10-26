package com.chisikiroom.practice.infrastructure.persistence.repository;

import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.identity.infrastructure.persistence.entity.UserEntity;
import com.chisikiroom.practice.infrastructure.persistence.entity.LearningGoalEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class LearningRepository {

    private final JpaStore store;

    public LearningRepository(JpaStore store) {
        this.store = store;
    }

    public Optional<LearningGoalEntity> findGoal(UUID userId) {
        return store.find(LearningGoalEntity.class, userId);
    }

    public void saveGoal(UUID userId, int dailyQuestions) {
        // Lock the existing account even when the user's first goal has no row yet.
        store.lock(UserEntity.class, userId);
        Optional<LearningGoalEntity> existing = findGoal(userId);
        if (existing.isPresent()) {
            existing.get().dailyQuestions = dailyQuestions;
            return;
        }
        LearningGoalEntity goal = new LearningGoalEntity();
        goal.userId = userId;
        goal.dailyQuestions = dailyQuestions;
        store.insert(goal);
    }
}
