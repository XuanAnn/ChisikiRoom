package com.chisikiroom.calling.infrastructure.persistence.entity;

import com.chisikiroom.calling.infrastructure.persistence.key.CallParticipantId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "call_participants")
@IdClass(CallParticipantId.class)
public class CallParticipantEntity {

    @Id
    @Column(name = "call_id", nullable = false)
    public UUID callId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "camera", nullable = false)
    public boolean camera;

    @Column(name = "last_seen", nullable = false)
    public OffsetDateTime lastSeen;
}
