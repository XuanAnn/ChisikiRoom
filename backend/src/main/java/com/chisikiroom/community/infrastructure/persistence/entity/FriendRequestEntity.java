package com.chisikiroom.community.infrastructure.persistence.entity;

import com.chisikiroom.community.infrastructure.persistence.key.FriendRequestId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "friend_requests")
@IdClass(FriendRequestId.class)
public class FriendRequestEntity {

    @Id
    @Column(name = "sender_id", nullable = false)
    public UUID senderId;

    @Id
    @Column(name = "recipient_id", nullable = false)
    public UUID recipientId;

    @Column(name = "status", nullable = false, length = 20)
    public String status = "PENDING";

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
