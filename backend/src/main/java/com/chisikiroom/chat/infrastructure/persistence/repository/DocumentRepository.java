package com.chisikiroom.chat.infrastructure.persistence.repository;

import com.chisikiroom.chat.infrastructure.persistence.entity.DocumentEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {
    List<DocumentEntity> findTop100ByRoomIdOrderByCreatedAtDesc(UUID roomId);
}
