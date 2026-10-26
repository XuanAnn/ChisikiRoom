package com.chisikiroom.battle.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battles")
public class BattleEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "room_id")
    public UUID roomId;

    @Column(name = "question_set_id", nullable = false)
    public UUID questionSetId;

    @Column(name = "owner_id", nullable = false)
    public UUID ownerId;

    @Column(name = "title", nullable = false, length = 120)
    public String title;

    @Column(name = "ranked_level", length = 2)
    public String rankedLevel;

    @Column(name = "ranked_result", length = 36)
    public String rankedResult;

    @Column(name = "status", nullable = false, length = 20)
    public String status = "WAITING";

    @Column(name = "question_snapshot", columnDefinition = "text")
    public String questionSnapshot;

    @Column(name = "round_no", nullable = false)
    public Integer roundNo = 0;

    @Column(name = "sequence", nullable = false)
    public Long sequence = 0L;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}
