package com.chisikiroom.chat.infrastructure.persistence.entity;

import com.chisikiroom.chat.infrastructure.persistence.key.ReactionId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "message_reactions")
@IdClass(ReactionId.class)
public class ReactionEntity {

    @Id
    @Column(name = "message_id", nullable = false)
    public Long messageId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Id
    @Column(name = "emoji", nullable = false, length = 20)
    public String emoji;
}
