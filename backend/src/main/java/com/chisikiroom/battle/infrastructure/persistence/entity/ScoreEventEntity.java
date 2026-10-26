package com.chisikiroom.battle.infrastructure.persistence.entity;

import com.chisikiroom.battle.infrastructure.persistence.key.ScoreEventId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battle_score_events")
@IdClass(ScoreEventId.class)
public class ScoreEventEntity {

    @Id
    @Column(name = "round_id", nullable = false)
    public UUID roundId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "delta", nullable = false)
    public Integer delta;
}
