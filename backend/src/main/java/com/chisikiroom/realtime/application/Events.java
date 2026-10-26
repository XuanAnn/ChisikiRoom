package com.chisikiroom.realtime.application;

import java.util.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.*;

@Component
public class Events {

    private final SimpMessagingTemplate broker;

    public Events(SimpMessagingTemplate broker) {
        this.broker = broker;
    }

    public void send(Collection<UUID> users, String type, Object data) {
        var event = Map.of("eventId", UUID.randomUUID().toString(), "type", type, "data", data);
        var recipients = List.copyOf(users);
        Runnable publish = () ->
            recipients.forEach(id ->
                broker.convertAndSendToUser(id.toString(), "/queue/events", event)
            );
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        publish.run();
                    }
                }
            );
        } else {
            publish.run();
        }
    }
}
