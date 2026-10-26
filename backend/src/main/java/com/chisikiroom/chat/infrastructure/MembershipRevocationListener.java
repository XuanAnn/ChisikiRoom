package com.chisikiroom.chat.infrastructure;

import com.chisikiroom.battle.application.BattleService;
import com.chisikiroom.calling.application.CallService;
import com.chisikiroom.chat.application.ChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class MembershipRevocationListener {

    private static final Logger LOG = LoggerFactory.getLogger(MembershipRevocationListener.class);
    private final BattleService battles;
    private final CallService calls;

    public MembershipRevocationListener(BattleService battles, CallService calls) {
        this.battles = battles;
        this.calls = calls;
    }

    @TransactionalEventListener
    public void revoked(ChatService.MembershipRevoked event) {
        try {
            battles.revokeRoomMember(event.roomId());
        } catch (Exception exception) {
            LOG.error("Membership battle cleanup failed for room {}", event.roomId(), exception);
        }
        try {
            calls.cleanupRoomMembership(event.roomId());
        } catch (Exception exception) {
            LOG.error("Membership call cleanup failed for room {}", event.roomId(), exception);
        }
    }
}
