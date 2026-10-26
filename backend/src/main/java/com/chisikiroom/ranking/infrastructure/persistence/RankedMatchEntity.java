package com.chisikiroom.ranking.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ranked_matches")
public class RankedMatchEntity {

    @Id
    public UUID id;

    @Column(nullable = false)
    public int season;

    @Column(nullable = false, length = 2)
    public String level;

    @Column(name = "first_user", nullable = false)
    public UUID firstUser;

    @Column(name = "second_user", nullable = false)
    public UUID secondUser;

    @Column(nullable = false, length = 20)
    public String status;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt;

    @Column(name = "finished_at")
    public OffsetDateTime finishedAt;

    @Column(name = "first_before")
    public Double firstBefore;

    @Column(name = "second_before")
    public Double secondBefore;

    @Column(name = "first_after")
    public Double firstAfter;

    @Column(name = "second_after")
    public Double secondAfter;

    @Column(length = 20)
    public String outcome;
}
