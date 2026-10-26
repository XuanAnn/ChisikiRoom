package com.chisikiroom.calling.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "room_calls")
public class RoomCallEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Column(name = "caller_id", nullable = false)
    public UUID callerId;

    @Column(name = "status", nullable = false, length = 12)
    public String status;

    @Column(name = "sequence", nullable = false)
    public Long sequence = 1L;

    @Column(name = "answered", nullable = false)
    public boolean answered;

    @Column(name = "started_at", nullable = false)
    public OffsetDateTime startedAt;

    @Column(name = "updated_at", nullable = false)
    public OffsetDateTime updatedAt;
}
