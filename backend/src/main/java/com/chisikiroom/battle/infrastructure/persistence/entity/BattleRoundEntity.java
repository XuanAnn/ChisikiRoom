package com.chisikiroom.battle.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battle_rounds")
public class BattleRoundEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "battle_id", nullable = false)
    public UUID battleId;

    @Column(name = "round_no", nullable = false)
    public Integer roundNo;

    @Column(name = "status", nullable = false, length = 20)
    public String status = "OPEN";

    @Column(name = "question_snapshot", nullable = false, columnDefinition = "text")
    public String questionSnapshot;

    @Column(name = "deadline_at", nullable = false)
    public OffsetDateTime deadlineAt;

    @Column(name = "next_question_at")
    public OffsetDateTime nextQuestionAt;

    @Column(name = "winner_id")
    public UUID winnerId;

    @Column(name = "resolution_reason", length = 20)
    public String resolutionReason;
}
