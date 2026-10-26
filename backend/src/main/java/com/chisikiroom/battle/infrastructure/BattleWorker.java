package com.chisikiroom.battle.infrastructure;

import com.chisikiroom.battle.application.BattleService;
import com.chisikiroom.battle.infrastructure.persistence.*;
import com.chisikiroom.common.infrastructure.JpaStore;
import java.util.*;
import org.slf4j.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "chisiki.worker.enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class BattleWorker {

    private final JpaStore db;
    private final BattleService battles;
    private final SimpMessagingTemplate broker;
    private final TransactionTemplate transaction;
    private static final Logger log = LoggerFactory.getLogger(BattleWorker.class);

    public BattleWorker(
        JpaStore db,
        BattleService battles,
        SimpMessagingTemplate broker,
        TransactionTemplate transaction
    ) {
        this.db = db;
        this.battles = battles;
        this.broker = broker;
        this.transaction = transaction;
    }

    @Scheduled(fixedDelay = 250)
    public void tick() {
        var ids = transaction.execute(status ->
            db.list(UUID.class, "select b.id from BattleEntity b where b.status='IN_PROGRESS'")
        );
        for (UUID id : ids) {
            try {
                battles.tick(id);
            } catch (Exception e) {
                log.error("Battle tick failed for {}", id, e);
            }
        }
    }

    @Scheduled(fixedDelay = 200)
    public void publish() {
        var ids = transaction.execute(status ->
            db.limited(
                UUID.class,
                "select e.id from BattleEventEntity e where e.published=false order by e.createdAt,e.sequence",
                100
            )
        );
        for (UUID id : ids) {
            try {
                transaction.executeWithoutResult(status -> {
                    var event = db.lock(BattleEventEntity.class, id);
                    if (event.isEmpty() || event.get().published) {
                        return;
                    }
                    var e = event.get();
                    var recipients = new LinkedHashSet<>(
                        db.list(
                            UUID.class,
                            "select p.userId from BattlePlayerEntity p where p.battleId=:id",
                            "id",
                            e.battleId
                        )
                    );
                    recipients.addAll(
                        db.list(
                            UUID.class,
                            "select m.userId from RoomMemberEntity m, BattleEntity b where m.roomId=b.roomId and b.id=:id",
                            "id",
                            e.battleId
                        )
                    );
                    var message = Map.of(
                        "eventId",
                        e.id,
                        "type",
                        e.eventType,
                        "data",
                        Map.of("battleId", e.battleId, "sequence", e.sequence)
                    );
                    for (UUID user : recipients) {
                        broker.convertAndSendToUser(user.toString(), "/queue/events", message);
                    }
                    e.published = true;
                    e.attempts++;
                });
            } catch (Exception e) {
                log.error("Outbox publish failed for {}", id, e);
            }
        }
    }
}
