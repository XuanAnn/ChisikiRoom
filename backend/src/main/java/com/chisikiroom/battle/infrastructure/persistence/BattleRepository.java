package com.chisikiroom.battle.infrastructure.persistence;

import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.identity.infrastructure.persistence.UserEntity;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Typed persistence operations; application services own business decisions and transactions. */
@Repository
public class BattleRepository {

    private final JpaStore persistence;

    public BattleRepository(JpaStore persistence) {
        this.persistence = persistence;
    }

    public Optional<BattleEntity> lockBattle(UUID battleId) {
        return persistence.lock(BattleEntity.class, battleId);
    }

    public Optional<BattleEntity> findBattle(UUID battleId) {
        return persistence.find(BattleEntity.class, battleId);
    }

    public List<BattlePlayerEntity> findPlayers(UUID battleId) {
        return persistence.list(
            BattlePlayerEntity.class,
            "from BattlePlayerEntity p where p.battleId=:id order by p.joinedAt,p.userId",
            "id",
            battleId
        );
    }

    public Optional<UserEntity> findUser(UUID userId) {
        return persistence.find(UserEntity.class, userId);
    }

    public Optional<BattlePlayerEntity> findPlayer(UUID battleId, UUID userId) {
        return persistence.find(
            BattlePlayerEntity.class,
            new BattlePlayerEntity.Key(battleId, userId)
        );
    }

    public Optional<BattleRoundEntity> findRound(UUID battleId, int roundNumber) {
        return persistence.one(
            BattleRoundEntity.class,
            "from BattleRoundEntity r where r.battleId=:id and r.roundNo=:number",
            "id",
            battleId,
            "number",
            roundNumber
        );
    }

    public List<UUID> findRecentBattleIds(UUID roomId) {
        return persistence.limited(
            UUID.class,
            "select b.id from BattleEntity b where b.roomId=:room order by b.createdAt desc",
            15,
            "room",
            roomId
        );
    }

    public Optional<BattleAnswerEntity> findAnswer(UUID roundId, UUID userId) {
        return persistence.find(
            BattleAnswerEntity.class,
            new BattleAnswerEntity.Key(roundId, userId)
        );
    }

    public void insertBattle(BattleEntity battle) {
        persistence.insert(battle);
    }

    public void insertPlayer(BattlePlayerEntity player) {
        persistence.insert(player);
    }

    public void insertRound(BattleRoundEntity round) {
        persistence.insert(round);
    }

    public Optional<BattleAnswerEntity> findAnswerByRequest(UUID requestId) {
        return persistence.one(
            BattleAnswerEntity.class,
            "from BattleAnswerEntity a where a.requestId=:request",
            "request",
            requestId
        );
    }

    public void insertAnswer(BattleAnswerEntity answer) {
        persistence.insert(answer);
    }

    public void insertScoreEvent(ScoreEventEntity scoreEvent) {
        persistence.insert(scoreEvent);
    }

    public void insertOutboxEvent(BattleEventEntity outboxEvent) {
        persistence.insert(outboxEvent);
    }
}
