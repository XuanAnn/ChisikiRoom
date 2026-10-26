package com.chisikiroom.chat.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "messages")
public class MessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    public Long id;

    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Column(name = "sender_id", nullable = false)
    public UUID senderId;

    @Column(name = "content", nullable = false, length = 4000)
    public String content;

    @Column(nullable = false)
    public Long revision = 0L;

    @Column(name = "reply_to_id")
    public Long replyToId;

    @Column(name = "edited_at")
    public OffsetDateTime editedAt;

    @Column(name = "deleted_at")
    public OffsetDateTime deletedAt;

    @Column(name = "pinned_at")
    public OffsetDateTime pinnedAt;

    @Column(name = "request_id", nullable = false)
    public UUID requestId;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
