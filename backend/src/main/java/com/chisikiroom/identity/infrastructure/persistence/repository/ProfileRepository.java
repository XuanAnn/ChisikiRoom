package com.chisikiroom.identity.infrastructure.persistence.repository;

import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.identity.infrastructure.persistence.entity.UserEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class ProfileRepository {

    private final UserRepository users;
    private final JpaStore persistence;

    public ProfileRepository(UserRepository users, JpaStore persistence) {
        this.users = users;
        this.persistence = persistence;
    }

    public Optional<UserEntity> findById(UUID userId) {
        return users.findById(userId);
    }

    public UserEntity lockById(UUID userId) {
        return persistence.lock(UserEntity.class, userId).orElseThrow();
    }
}
