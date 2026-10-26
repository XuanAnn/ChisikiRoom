package com.chisikiroom.battle.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battle_events")
public class BattleEventEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "battle_id", nullable = false)
    public UUID battleId;

    @Column(name = "sequence", nullable = false)
    public Long sequence;

    @Column(name = "event_type", nullable = false, length = 40)
    public String eventType;

    @Column(name = "published", nullable = false)
    public boolean published;

    @Column(name = "attempts", nullable = false)
    public Integer attempts = 0;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
