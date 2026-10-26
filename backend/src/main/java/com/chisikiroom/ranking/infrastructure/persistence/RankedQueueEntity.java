package com.chisikiroom.ranking.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ranked_queue")
public class RankedQueueEntity {

    @Id
    @Column(name = "user_id")
    public UUID userId;

    @Column(nullable = false, length = 2)
    public String level;

    @Column(nullable = false)
    public int season;

    @Column(name = "joined_at", nullable = false)
    public OffsetDateTime joinedAt;

    @Column(name = "last_seen", nullable = false)
    public OffsetDateTime lastSeen;

    @Column(name = "match_id")
    public UUID matchId;
}
