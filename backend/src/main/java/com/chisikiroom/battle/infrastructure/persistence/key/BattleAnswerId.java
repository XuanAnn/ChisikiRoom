package com.chisikiroom.battle.infrastructure.persistence.key;

import java.io.Serializable;
import java.util.*;

public class BattleAnswerId implements Serializable {

    public UUID roundId;
    public UUID userId;

    public BattleAnswerId() {}

    public BattleAnswerId(UUID roundId, UUID userId) {
        this.roundId = roundId;
        this.userId = userId;
    }

    @Override
    public boolean equals(Object other) {
        return (
            other instanceof BattleAnswerId otherId &&
            Objects.equals(roundId, otherId.roundId) &&
            Objects.equals(userId, otherId.userId)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(roundId, userId);
    }
}
