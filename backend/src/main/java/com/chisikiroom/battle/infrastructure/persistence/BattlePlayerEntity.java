package com.chisikiroom.battle.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "battle_players")
@IdClass(BattlePlayerEntity.Key.class)
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

    public static class Key implements Serializable {

        public UUID battleId;
        public UUID userId;

        public Key() {}

        public Key(UUID battleId, UUID userId) {
            this.battleId = battleId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            return (
                other instanceof Key k &&
                Objects.equals(battleId, k.battleId) &&
                Objects.equals(userId, k.userId)
            );
        }

        @Override
        public int hashCode() {
            return Objects.hash(battleId, userId);
        }
    }
}
