package com.chisikiroom.administration.application;

import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class TrafficMonitor {

    public record Address(String ip, Instant lastSeen) {}

    public record Transfer(
        Instant time,
        UUID senderId,
        String senderIp,
        List<Recipient> recipients,
        String type,
        String summary
    ) {}

    public record Recipient(UUID userId, String ip) {}

    private final Map<UUID, Address> addresses = new LinkedHashMap<>();
    private final Deque<Transfer> transfers = new ArrayDeque<>();

    public synchronized void touch(UUID userId, String ip) {
        addresses.remove(userId);
        addresses.put(userId, new Address(ip, Instant.now()));
        if (addresses.size() > 5000) {
            addresses.remove(addresses.keySet().iterator().next());
        }
    }

    public synchronized Map<UUID, Address> addresses() {
        return Map.copyOf(addresses);
    }

    public synchronized void record(
        UUID sender,
        String senderIp,
        List<UUID> recipients,
        String type,
        String summary
    ) {
        List<Recipient> targets = recipients
            .stream()
            .distinct()
            .map(id ->
                new Recipient(
                    id,
                    addresses.getOrDefault(id, new Address("Chưa ghi nhận", Instant.EPOCH)).ip()
                )
            )
            .toList();
        transfers.addFirst(new Transfer(Instant.now(), sender, senderIp, targets, type, summary));
        while (transfers.size() > 500) {
            transfers.removeLast();
        }
    }

    public synchronized List<Transfer> transfers() {
        return List.copyOf(transfers);
    }
}
