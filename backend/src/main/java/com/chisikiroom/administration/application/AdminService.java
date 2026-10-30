package com.chisikiroom.administration.application;

import com.chisikiroom.administration.infrastructure.persistence.repository.AdminRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminService {

    private final AdminRepository repository;
    private final TrafficMonitor monitor;
    private final String key;

    public AdminService(
        AdminRepository repository,
        TrafficMonitor monitor,
        @Value("${CHISIKI_ADMIN_KEY:}") String key
    ) {
        this.repository = repository;
        this.monitor = monitor;
        this.key = key;
    }

    public void authorize(String supplied) {
        if (
            key.length() < 32 ||
            supplied == null ||
            supplied.length() > 256 ||
            !MessageDigest.isEqual(
                key.getBytes(StandardCharsets.UTF_8),
                supplied.getBytes(StandardCharsets.UTF_8)
            )
        ) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin access denied");
        }
    }

    public record User(UUID id, String displayName, String email) {}

    public record Participant(UUID activityId, UUID userId, String status, Integer score) {}

    public record Activity(UUID id, UUID roomId, String title, String status) {}

    public record Snapshot(
        List<User> users,
        Map<UUID, TrafficMonitor.Address> addresses,
        List<Activity> calls,
        List<Activity> battles,
        List<Participant> callParticipants,
        List<Participant> battleParticipants,
        List<TrafficMonitor.Transfer> transfers
    ) {}

    @Transactional(readOnly = true)
    public Snapshot snapshot() {
        return new Snapshot(
            repository.users(),
            monitor.addresses(),
            repository.calls(),
            repository.battles(),
            repository.callParticipants(),
            repository.battleParticipants(),
            monitor.transfers()
        );
    }

    @Transactional
    public void revokeSessions(UUID userId) {
        repository.revokeSessions(userId);
    }
}
