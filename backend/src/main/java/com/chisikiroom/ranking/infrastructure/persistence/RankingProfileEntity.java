package com.chisikiroom.ranking.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ranking_profiles")
public class RankingProfileEntity {

    @Id
    public UUID id;

    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(nullable = false, length = 2)
    public String level;

    @Column(nullable = false)
    public int season;

    @Column(nullable = false)
    public double rating;

    @Column(nullable = false)
    public double deviation;

    @Column(nullable = false)
    public double volatility;

    @Column(nullable = false)
    public int games;

    @Column(nullable = false)
    public int wins;

    @Column(nullable = false)
    public int draws;

    @Column(name = "updated_at", nullable = false)
    public OffsetDateTime updatedAt;
}
