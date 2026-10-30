package com.chisikiroom.administration.infrastructure.persistence.repository;

import com.chisikiroom.administration.application.AdminService.*;
import com.chisikiroom.battle.infrastructure.persistence.entity.*;
import com.chisikiroom.calling.infrastructure.persistence.entity.*;
import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.identity.infrastructure.persistence.entity.UserEntity;
import com.chisikiroom.identity.infrastructure.persistence.entity.UserSessionEntity;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class AdminRepository {

    private final JpaStore store;

    public AdminRepository(JpaStore store) {
        this.store = store;
    }

    public List<User> users() {
        return store
            .limited(UserEntity.class, "from UserEntity u order by u.createdAt desc", 1000)
            .stream()
            .map(u -> new User(u.id, u.displayName, u.email))
            .toList();
    }

    public List<Activity> calls() {
        return store
            .limited(
                RoomCallEntity.class,
                "from RoomCallEntity c where c.status='ACTIVE' order by c.startedAt desc",
                200
            )
            .stream()
            .map(c -> new Activity(c.id, c.roomId, "Cuộc gọi", c.status))
            .toList();
    }

    public List<Activity> battles() {
        return store
            .limited(
                BattleEntity.class,
                "from BattleEntity b where b.status in ('WAITING','IN_PROGRESS') order by b.createdAt desc",
                200
            )
            .stream()
            .map(b -> new Activity(b.id, b.roomId, b.title, b.status))
            .toList();
    }

    public List<Participant> callParticipants() {
        return store
            .limited(
                CallParticipantEntity.class,
                "select p from CallParticipantEntity p, RoomCallEntity c where p.callId=c.id and c.status='ACTIVE' order by c.startedAt desc",
                800
            )
            .stream()
            .map(p -> new Participant(p.callId, p.userId, "Tham gia", null))
            .toList();
    }

    public List<Participant> battleParticipants() {
        return store
            .limited(
                BattlePlayerEntity.class,
                "select p from BattlePlayerEntity p, BattleEntity b where p.battleId=b.id and b.status in ('WAITING','IN_PROGRESS') order by b.createdAt desc",
                800
            )
            .stream()
            .map(p -> new Participant(p.battleId, p.userId, p.status, p.score))
            .toList();
    }

    public void revokeSessions(UUID userId) {
        for (UserSessionEntity session : store.list(
            UserSessionEntity.class,
            "from UserSessionEntity s where s.userId=:userId",
            "userId",
            userId
        )) {
            store.delete(session);
        }
    }
}
