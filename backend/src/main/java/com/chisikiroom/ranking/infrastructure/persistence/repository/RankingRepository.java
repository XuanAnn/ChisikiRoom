package com.chisikiroom.ranking.infrastructure.persistence.repository;

import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.identity.infrastructure.persistence.entity.UserEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankedMatchEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankedQuestionEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankedQueueEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankingGuardEntity;
import com.chisikiroom.ranking.infrastructure.persistence.entity.RankingProfileEntity;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class RankingRepository {

    private final JpaStore store;

    public RankingRepository(JpaStore store) {
        this.store = store;
    }

    public void lock() {
        store.lock(RankingGuardEntity.class, 1).orElseThrow();
    }

    public Optional<RankingProfileEntity> profile(UUID user, String level, int season) {
        return store.one(
            RankingProfileEntity.class,
            "from RankingProfileEntity p where p.userId=:user and p.level=:level and p.season=:season",
            "user",
            user,
            "level",
            level,
            "season",
            season
        );
    }

    public List<RankingProfileEntity> board(String level, int season) {
        return store.limited(
            RankingProfileEntity.class,
            "from RankingProfileEntity p where p.level=:level and p.season=:season and p.games>=5 order by p.rating desc,p.userId",
            100,
            "level",
            level,
            "season",
            season
        );
    }

    public Optional<RankedQueueEntity> queue(UUID user) {
        return store.find(RankedQueueEntity.class, user);
    }

    public List<RankedQueueEntity> queues() {
        return store.list(
            RankedQueueEntity.class,
            "from RankedQueueEntity q order by q.joinedAt,q.userId"
        );
    }

    public List<RankedMatchEntity> pending() {
        return store.limited(
            RankedMatchEntity.class,
            "from RankedMatchEntity m where m.status='MATCHED' order by m.createdAt",
            100
        );
    }

    public RankedMatchEntity match(UUID id) {
        return store.find(RankedMatchEntity.class, id).orElseThrow();
    }

    public List<RankedMatchEntity> history(UUID user) {
        return store.limited(
            RankedMatchEntity.class,
            "from RankedMatchEntity m where m.firstUser=:user or m.secondUser=:user order by m.createdAt desc",
            30,
            "user",
            user
        );
    }

    public List<RankedMatchEntity> recentPair(UUID first, UUID second, OffsetDateTime since) {
        return store.list(
            RankedMatchEntity.class,
            "from RankedMatchEntity m where ((m.firstUser=:first and m.secondUser=:second) or (m.firstUser=:second and m.secondUser=:first)) and m.createdAt>=:since and m.status<>'VOID' order by m.createdAt desc",
            "first",
            first,
            "second",
            second,
            "since",
            since
        );
    }

    public String name(UUID user) {
        return store.find(UserEntity.class, user).orElseThrow().displayName;
    }

    public List<RankedQuestionEntity> questions(String level) {
        return store.list(
            RankedQuestionEntity.class,
            "from RankedQuestionEntity q where q.level=:level order by q.id",
            "level",
            level
        );
    }

    public boolean hasQuestion(UUID id) {
        return store.find(RankedQuestionEntity.class, id).isPresent();
    }

    public void insertProfile(RankingProfileEntity entity) {
        store.insert(entity);
    }

    public void insertMatch(RankedMatchEntity entity) {
        store.insert(entity);
    }

    public void insertQueue(RankedQueueEntity entity) {
        store.insert(entity);
    }

    public void insertQuestion(RankedQuestionEntity entity) {
        store.insert(entity);
    }

    public void removeQueue(RankedQueueEntity queue) {
        store.delete(queue);
    }

    public void flush() {
        store.flush();
    }
}
