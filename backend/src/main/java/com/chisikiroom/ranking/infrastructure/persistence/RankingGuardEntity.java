package com.chisikiroom.ranking.infrastructure.persistence;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ranking_guard")
public class RankingGuardEntity {

    @Id
    public Integer id;
}
