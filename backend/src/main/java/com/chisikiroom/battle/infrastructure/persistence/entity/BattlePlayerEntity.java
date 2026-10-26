package com.chisikiroom.battle.infrastructure.persistence.entity;

import com.chisikiroom.battle.infrastructure.persistence.key.BattlePlayerId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battle_players")
@IdClass(BattlePlayerId.class)
public class BattlePlayerEntity {

    @Id
    @Column(name = "battle_id", nullable = false)
    public UUID battleId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "score", nullable = false)
    public Integer score = 0;

    @Column(name = "ready", nullable = false)
    public boolean ready;

    @Column(name = "camera", nullable = false)
    public boolean camera;

    @Column(name = "status", nullable = false, length = 20)
    public String status = "ACTIVE";

    @Column(name = "last_seen", nullable = false)
    public OffsetDateTime lastSeen = OffsetDateTime.now();

    @Column(name = "unavailable_since")
    public OffsetDateTime unavailableSince;

    @Column(name = "joined_at", nullable = false)
    public OffsetDateTime joinedAt = OffsetDateTime.now();
}
