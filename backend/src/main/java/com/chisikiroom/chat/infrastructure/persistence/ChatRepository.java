package com.chisikiroom.chat.infrastructure.persistence;

import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.community.infrastructure.persistence.FriendshipEntity;
import com.chisikiroom.identity.infrastructure.persistence.UserEntity;
import java.util.*;
import org.springframework.stereotype.Repository;

/** Typed persistence operations; application services own business decisions and transactions. */
@Repository
public class ChatRepository {

    private final JpaStore persistence;

    public ChatRepository(JpaStore persistence) {
        this.persistence = persistence;
    }

    public List<ChatRoomEntity> findVisibleRooms(UUID userId) {
        return persistence.list(
            ChatRoomEntity.class,
            "from ChatRoomEntity r where r.privateRoom=false or exists(select m.userId from RoomMemberEntity m where m.roomId=r.id and m.userId=:user) order by r.createdAt,r.id",
            "user",
            userId
        );
    }

    public Optional<DirectChatEntity> findDirectChat(UUID roomId) {
        return persistence.find(DirectChatEntity.class, roomId);
    }

    public Optional<UserEntity> findUser(UUID userId) {
        return persistence.find(UserEntity.class, userId);
    }

    public Optional<RoomMemberEntity> findMembership(UUID roomId, UUID userId) {
        return persistence.find(RoomMemberEntity.class, new RoomMemberEntity.Key(roomId, userId));
    }

    public Optional<ChatRoomEntity> lockRoom(UUID roomId) {
        return persistence.lock(ChatRoomEntity.class, roomId);
    }

    public void insertRoom(ChatRoomEntity room) {
        persistence.insert(room);
    }

    public List<UUID> findUserIdsInDatabaseOrder(List<UUID> userIds) {
        return persistence.list(
            UUID.class,
            "select u.id from UserEntity u where u.id in (:ids) order by u.id",
            "ids",
            userIds
        );
    }

    public Optional<UserEntity> lockUser(UUID userId) {
        return persistence.lock(UserEntity.class, userId);
    }

    public Optional<FriendshipEntity> findFriendship(UUID userId, UUID friendId) {
        return persistence.find(FriendshipEntity.class, new FriendshipEntity.Key(userId, friendId));
    }

    public Optional<DirectChatEntity> findDirectBetween(UUID lowerUserId, UUID higherUserId) {
        return persistence.one(
            DirectChatEntity.class,
            "from DirectChatEntity d where d.userLow=:low and d.userHigh=:high",
            "low",
            lowerUserId,
            "high",
            higherUserId
        );
    }

    public Optional<ChatRoomEntity> findRoom(UUID roomId) {
        return persistence.find(ChatRoomEntity.class, roomId);
    }

    public void insertDirectChat(DirectChatEntity directChat) {
        persistence.insert(directChat);
    }

    public void insertMembership(RoomMemberEntity membership) {
        persistence.insert(membership);
    }

    public void deleteMembership(RoomMemberEntity membership) {
        persistence.delete(membership);
    }

    public void flush() {
        persistence.flush();
    }

    public void deleteRoom(ChatRoomEntity room) {
        persistence.delete(room);
    }

    public List<UUID> findMemberIds(UUID roomId) {
        return persistence.list(
            UUID.class,
            "select m.userId from RoomMemberEntity m where m.roomId=:room order by m.joinedAt,m.userId",
            "room",
            roomId
        );
    }

    public record MemberProfile(UUID id, String displayName) {}

    public List<MemberProfile> findMemberProfiles(UUID roomId) {
        return persistence
            .list(
                Object[].class,
                "select u.id,u.displayName from UserEntity u, RoomMemberEntity m where u.id=m.userId and m.roomId=:room order by m.joinedAt,u.id",
                "room",
                roomId
            )
            .stream()
            .map(row -> new MemberProfile((UUID) row[0], (String) row[1]))
            .toList();
    }

    public List<MessageEntity> findHistoryPage(UUID roomId, long beforeMessageId) {
        return persistence.limited(
            MessageEntity.class,
            "from MessageEntity m where m.roomId=:room and m.id<:before order by m.id desc",
            50,
            "room",
            roomId,
            "before",
            beforeMessageId
        );
    }

    public Optional<MessageEntity> findMessageByRequest(UUID senderId, UUID requestId) {
        return persistence.one(
            MessageEntity.class,
            "from MessageEntity m where m.senderId=:user and m.requestId=:request",
            "user",
            senderId,
            "request",
            requestId
        );
    }

    public void insertMessage(MessageEntity message) {
        persistence.insert(message);
    }

    public List<MessageEntity> searchHistory(
        UUID roomId,
        String escapedQuery,
        long beforeMessageId
    ) {
        return persistence.limited(
            MessageEntity.class,
            """
            from MessageEntity message
            where message.roomId = :roomId and message.id < :before
              and lower(message.content) like :query escape '!'
            order by message.id desc
            """,
            50,
            "roomId",
            roomId,
            "before",
            beforeMessageId,
            "query",
            "%" + escapedQuery + "%"
        );
    }
}
