package com.chisikiroom.chat.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "documents")
public class DocumentEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Column(name = "uploaded_by", nullable = false)
    public UUID uploadedBy;

    @Column(name = "filename", nullable = false, length = 180)
    public String filename;

    @Column(name = "content_type", nullable = false, length = 100)
    public String contentType;

    @Column(name = "size_bytes", nullable = false)
    public Long sizeBytes;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
