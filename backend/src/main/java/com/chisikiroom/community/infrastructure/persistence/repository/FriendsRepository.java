package com.chisikiroom.community.infrastructure.persistence.repository;

import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.community.infrastructure.persistence.entity.FriendRequestEntity;
import com.chisikiroom.community.infrastructure.persistence.entity.FriendshipEntity;
import com.chisikiroom.community.infrastructure.persistence.key.FriendRequestId;
import com.chisikiroom.community.infrastructure.persistence.key.FriendshipId;
import com.chisikiroom.identity.infrastructure.persistence.entity.UserEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class FriendsRepository {

    private final JpaStore persistence;

    public FriendsRepository(JpaStore persistence) {
        this.persistence = persistence;
    }

    public record PendingInvitation(
        UUID senderId,
        String senderName,
        UUID recipientId,
        String recipientName
    ) {}

    public List<UserEntity> searchUsers(String escapedName) {
        return persistence.limited(
            UserEntity.class,
            "from UserEntity user where lower(user.displayName) like :query escape '!' order by user.displayName",
            20,
            "query",
            "%" + escapedName + "%"
        );
    }

    public List<UserEntity> findFriends(UUID userId) {
        return persistence.list(
            UserEntity.class,
            """
            select user from UserEntity user, FriendshipEntity friendship
            where user.id = friendship.friendId and friendship.userId = :userId
            order by user.displayName
            """,
            "userId",
            userId
        );
    }

    public List<PendingInvitation> findPendingInvitations(UUID userId) {
        return persistence
            .list(
                Object[].class,
                """
                select request.senderId, sender.displayName, request.recipientId, recipient.displayName
                from FriendRequestEntity request, UserEntity sender, UserEntity recipient
                where sender.id = request.senderId and recipient.id = request.recipientId
                  and (request.recipientId = :userId or request.senderId = :userId)
                  and request.status = 'PENDING'
                """,
                "userId",
                userId
            )
            .stream()
            .map(row ->
                new PendingInvitation(
                    (UUID) row[0],
                    (String) row[1],
                    (UUID) row[2],
                    (String) row[3]
                )
            )
            .toList();
    }

    /** Lock in database UUID order, matching direct-chat creation. */
    public boolean lockPair(UUID firstUserId, UUID secondUserId) {
        List<UUID> userIds = persistence.list(
            UUID.class,
            "select user.id from UserEntity user where user.id in (:ids) order by user.id",
            "ids",
            List.of(firstUserId, secondUserId)
        );
        if (userIds.size() != 2) {
            return false;
        }
        for (UUID userId : userIds) {
            persistence.lock(UserEntity.class, userId).orElseThrow();
        }
        return true;
    }

    public boolean areFriends(UUID userId, UUID friendId) {
        return persistence
            .find(FriendshipEntity.class, new FriendshipId(userId, friendId))
            .isPresent();
    }

    public Optional<FriendRequestEntity> findRequest(UUID senderId, UUID recipientId) {
        return persistence.find(
            FriendRequestEntity.class,
            new FriendRequestId(senderId, recipientId)
        );
    }

    public void insertRequest(FriendRequestEntity request) {
        persistence.insert(request);
    }

    public void addFriendship(UUID userId, UUID friendId) {
        if (areFriends(userId, friendId)) {
            return;
        }
        FriendshipEntity friendship = new FriendshipEntity();
        friendship.userId = userId;
        friendship.friendId = friendId;
        persistence.insert(friendship);
    }
}
