package com.chisikiroom.realtime.application;

import java.util.List;
import java.util.UUID;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Component;

@Component
public class UserPresence {

    private final SimpUserRegistry registry;

    public UserPresence(SimpUserRegistry registry) {
        this.registry = registry;
    }

    public boolean isOnline(UUID userId) {
        return registry.getUser(userId.toString()) != null;
    }

    public List<UUID> onlineUserIds() {
        return registry
            .getUsers()
            .stream()
            .map(user -> UUID.fromString(user.getName()))
            .toList();
    }
}
