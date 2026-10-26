package com.chisikiroom.battle.infrastructure.persistence.key;

import java.io.Serializable;
import java.util.*;

public class BattlePlayerId implements Serializable {

    public UUID battleId;
    public UUID userId;

    public BattlePlayerId() {}

    public BattlePlayerId(UUID battleId, UUID userId) {
        this.battleId = battleId;
        this.userId = userId;
    }

    @Override
    public boolean equals(Object other) {
        return (
            other instanceof BattlePlayerId otherId &&
            Objects.equals(battleId, otherId.battleId) &&
            Objects.equals(userId, otherId.userId)
        );
    }

    @Override
    public int hashCode() {
        return Objects.hash(battleId, userId);
    }
}
