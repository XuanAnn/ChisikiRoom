package com.chisikiroom.chat.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
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

    @Column(name = "request_id", nullable = false)
    public UUID requestId;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
