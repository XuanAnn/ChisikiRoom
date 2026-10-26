package com.chisikiroom.community.application;

import com.chisikiroom.community.infrastructure.persistence.FriendRequestEntity;
import com.chisikiroom.community.infrastructure.persistence.FriendsRepository;
import com.chisikiroom.identity.infrastructure.persistence.UserEntity;
import com.chisikiroom.realtime.application.Events;
import com.chisikiroom.realtime.application.UserPresence;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class FriendsService {

    private final FriendsRepository friends;
    private final Events events;
    private final UserPresence presence;

    public FriendsService(FriendsRepository friends, Events events, UserPresence presence) {
        this.friends = friends;
        this.events = events;
        this.presence = presence;
    }

    public record Person(UUID id, String displayName, boolean online) {}

    public record Invitation(
        UUID senderId,
        String senderName,
        UUID recipientId,
        String recipientName
    ) {}

    public List<Person> search(String query) {
        boolean invalidLength = query.strip().length() < 2 || query.length() > 60;
        if (invalidLength) {
            return List.of();
        }
        String escapedName = query
            .strip()
            .toLowerCase(Locale.ROOT)
            .replace("!", "!!")
            .replace("%", "!%")
            .replace("_", "!_");
        return friends.searchUsers(escapedName).stream().map(this::toPerson).toList();
    }

    public List<Person> listFriends(UUID userId) {
        return friends.findFriends(userId).stream().map(this::toPerson).toList();
    }

    public List<Invitation> invitations(UUID userId) {
        return friends
            .findPendingInvitations(userId)
            .stream()
            .map(invitation ->
                new Invitation(
                    invitation.senderId(),
                    invitation.senderName(),
                    invitation.recipientId(),
                    invitation.recipientName()
                )
            )
            .toList();
    }

    @Transactional
    public void invite(UUID userId, UUID friendId) {
        lockUsers(userId, friendId);
        if (friends.areFriends(userId, friendId)) {
            return;
        }
        var existingRequest = friends.findRequest(userId, friendId);
        if (existingRequest.isPresent()) {
            existingRequest.get().status = "PENDING";
        } else {
            FriendRequestEntity request = new FriendRequestEntity();
            request.senderId = userId;
            request.recipientId = friendId;
            friends.insertRequest(request);
        }
        notifyUsers(userId, friendId);
    }

    @Transactional
    public void respond(UUID userId, UUID senderId, boolean accept) {
        lockUsers(userId, senderId);
        FriendRequestEntity request = friends
            .findRequest(senderId, userId)
            .filter(invitation -> invitation.status.equals("PENDING"))
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không có lời mời đang chờ")
            );

        if (accept) {
            request.status = "ACCEPTED";
            friends.addFriendship(userId, senderId);
            friends.addFriendship(senderId, userId);
            friends
                .findRequest(userId, senderId)
                .filter(invitation -> invitation.status.equals("PENDING"))
                .ifPresent(invitation -> invitation.status = "ACCEPTED");
        } else {
            request.status = "REJECTED";
        }
        notifyUsers(userId, senderId);
    }

    private Person toPerson(UserEntity user) {
        return new Person(user.id, user.displayName, presence.isOnline(user.id));
    }

    private void lockUsers(UUID firstUserId, UUID secondUserId) {
        if (!friends.lockPair(firstUserId, secondUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Người dùng không hợp lệ");
        }
    }

    private void notifyUsers(UUID firstUserId, UUID secondUserId) {
        events.send(List.of(firstUserId, secondUserId), "FRIENDS_CHANGED", Map.of());
    }
}
