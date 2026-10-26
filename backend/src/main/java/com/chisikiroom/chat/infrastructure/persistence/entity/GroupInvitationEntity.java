package com.chisikiroom.chat.infrastructure.persistence.entity;

import com.chisikiroom.chat.infrastructure.persistence.key.GroupInvitationId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "group_invitations")
@IdClass(GroupInvitationId.class)
public class GroupInvitationEntity {

    @Id
    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "inviter_id", nullable = false)
    public UUID inviterId;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
