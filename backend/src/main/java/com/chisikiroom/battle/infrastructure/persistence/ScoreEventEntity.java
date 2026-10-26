package com.chisikiroom.battle.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battle_score_events")
@IdClass(ScoreEventEntity.Key.class)
public class ScoreEventEntity {

    @Id
    @Column(name = "round_id", nullable = false)
    public UUID roundId;

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "delta", nullable = false)
    public Integer delta;

    public static class Key implements Serializable {

        public UUID roundId;
        public UUID userId;

        public Key() {}

        public Key(UUID roundId, UUID userId) {
            this.roundId = roundId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            return (
                other instanceof Key k &&
                Objects.equals(roundId, k.roundId) &&
                Objects.equals(userId, k.userId)
            );
        }

        @Override
        public int hashCode() {
            return Objects.hash(roundId, userId);
        }
    }
}
