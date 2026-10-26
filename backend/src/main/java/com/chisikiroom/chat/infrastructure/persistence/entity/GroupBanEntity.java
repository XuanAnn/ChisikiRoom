package com.chisikiroom.chat.infrastructure.persistence.entity;

import com.chisikiroom.chat.infrastructure.persistence.key.GroupBanId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "group_bans")
@IdClass(GroupBanId.class)
public class GroupBanEntity {

    @Id
    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "blocked_by", nullable = false)
    public UUID blockedBy;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
