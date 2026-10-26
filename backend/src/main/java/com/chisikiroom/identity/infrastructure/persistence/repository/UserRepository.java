package com.chisikiroom.identity.infrastructure.persistence.repository;

import com.chisikiroom.identity.infrastructure.persistence.entity.UserEntity;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
}
