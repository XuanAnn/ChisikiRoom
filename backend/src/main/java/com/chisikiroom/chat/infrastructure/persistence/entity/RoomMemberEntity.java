package com.chisikiroom.chat.infrastructure.persistence.entity;

import com.chisikiroom.chat.infrastructure.persistence.key.RoomMemberId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "chat_room_members")
@IdClass(RoomMemberId.class)
public class RoomMemberEntity {

    @Id
    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(nullable = false, length = 10)
    public String role = "MEMBER";

    @Column(name = "last_read_id", nullable = false)
    public Long lastReadId = 0L;

    @Column(nullable = false, columnDefinition = "text")
    public String draft = "";

    @Column(name = "draft_version", nullable = false)
    public Long draftVersion = 0L;

    @Column(name = "joined_at", nullable = false)
    public OffsetDateTime joinedAt = OffsetDateTime.now();
}
