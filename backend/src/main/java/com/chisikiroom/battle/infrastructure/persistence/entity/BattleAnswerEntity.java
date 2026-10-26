package com.chisikiroom.battle.infrastructure.persistence.entity;

import com.chisikiroom.battle.infrastructure.persistence.key.BattleAnswerId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battle_answers")
@IdClass(BattleAnswerId.class)
public class BattleAnswerEntity {

    @Id
    @Column(name = "round_id", nullable = false)
    public UUID roundId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "request_id", nullable = false)
    public UUID requestId;

    @Column(name = "option_index", nullable = false)
    public Integer optionIndex;

    @Column(name = "is_correct", nullable = false)
    public boolean isCorrect;

    @Column(name = "submitted_at", nullable = false)
    public OffsetDateTime submittedAt = OffsetDateTime.now();
}
