package com.chisikiroom.chat.infrastructure.persistence.repository;

import com.chisikiroom.chat.infrastructure.persistence.entity.ChatRoomEntity;
import com.chisikiroom.chat.infrastructure.persistence.entity.DirectChatEntity;
import com.chisikiroom.chat.infrastructure.persistence.entity.GroupBanEntity;
import com.chisikiroom.chat.infrastructure.persistence.entity.GroupInvitationEntity;
import com.chisikiroom.chat.infrastructure.persistence.entity.MessageEntity;
import com.chisikiroom.chat.infrastructure.persistence.entity.RoomMemberEntity;
import com.chisikiroom.chat.infrastructure.persistence.key.GroupBanId;
import com.chisikiroom.chat.infrastructure.persistence.key.GroupInvitationId;
import com.chisikiroom.chat.infrastructure.persistence.key.RoomMemberId;
import com.chisikiroom.common.infrastructure.JpaStore;
import com.chisikiroom.community.infrastructure.persistence.entity.FriendshipEntity;
import com.chisikiroom.community.infrastructure.persistence.key.FriendshipId;
import com.chisikiroom.identity.infrastructure.persistence.entity.UserEntity;
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
            "from ChatRoomEntity r where r.archived=false and not exists(select ban.userId from GroupBanEntity ban where ban.roomId=r.id and ban.userId=:user) and (r.privateRoom=false or exists(select m.userId from RoomMemberEntity m where m.roomId=r.id and m.userId=:user)) order by r.createdAt,r.id",
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

    public Optional<GroupInvitationEntity> findInvitation(UUID roomId, UUID userId) {
        return persistence.find(GroupInvitationEntity.class, new GroupInvitationId(roomId, userId));
    }

    public void insertInvitation(GroupInvitationEntity invitation) {
        persistence.insert(invitation);
    }

    public void deleteInvitation(GroupInvitationEntity invitation) {
        persistence.delete(invitation);
    }

    public record InvitationProfile(
        UUID roomId,
        String roomName,
        String inviterName,
        java.time.OffsetDateTime createdAt
    ) {}

    public List<InvitationProfile> invitations(UUID userId) {
        return persistence
            .list(
                Object[].class,
                "select i.roomId,r.name,u.displayName,i.createdAt from GroupInvitationEntity i, ChatRoomEntity r, UserEntity u where i.userId=:user and i.roomId=r.id and r.archived=false and i.inviterId=u.id order by i.createdAt desc",
                "user",
                userId
            )
            .stream()
            .map(row ->
                new InvitationProfile(
                    (UUID) row[0],
                    (String) row[1],
                    (String) row[2],
                    (java.time.OffsetDateTime) row[3]
                )
            )
            .toList();
    }

    public List<RoomMemberEntity> memberships(UUID userId) {
        return persistence.list(
            RoomMemberEntity.class,
            "from RoomMemberEntity m where m.userId=:user",
            "user",
            userId
        );
    }

    public long unread(UUID roomId, UUID userId, long afterId) {
        return persistence
            .one(
                Long.class,
                "select count(m) from MessageEntity m where m.roomId=:room and m.senderId<>:user and m.deletedAt is null and m.id>:after",
                "room",
                roomId,
                "user",
                userId,
                "after",
                afterId
            )
            .orElse(0L);
    }

    public Optional<GroupBanEntity> ban(UUID room, UUID user) {
        return persistence.find(GroupBanEntity.class, new GroupBanId(room, user));
    }

    public void insertBan(GroupBanEntity ban) {
        persistence.insert(ban);
    }

    public void deleteBan(GroupBanEntity ban) {
        persistence.delete(ban);
    }

    public List<GroupBanEntity> bans(UUID room) {
        return persistence.list(
            GroupBanEntity.class,
            "from GroupBanEntity b where b.roomId=:room order by b.createdAt desc",
            "room",
            room
        );
    }

    public Optional<RoomMemberEntity> findMembership(UUID roomId, UUID userId) {
        return persistence.find(RoomMemberEntity.class, new RoomMemberId(roomId, userId));
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
        return persistence.find(FriendshipEntity.class, new FriendshipId(userId, friendId));
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

    public record MemberProfile(UUID id, String displayName, String role) {}

    public List<MemberProfile> findMemberProfiles(UUID roomId) {
        return persistence
            .list(
                Object[].class,
                "select u.id,u.displayName,m.role from UserEntity u, RoomMemberEntity m where u.id=m.userId and m.roomId=:room order by m.joinedAt,u.id",
                "room",
                roomId
            )
            .stream()
            .map(row -> new MemberProfile((UUID) row[0], (String) row[1], (String) row[2]))
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

    public Optional<MessageEntity> findMessage(long messageId, UUID roomId) {
        return persistence.one(
            MessageEntity.class,
            "from MessageEntity m where m.id=:id and m.roomId=:room",
            "id",
            messageId,
            "room",
            roomId
        );
    }

    public List<MessageEntity> pinned(UUID roomId) {
        return persistence.list(
            MessageEntity.class,
            "from MessageEntity m where m.roomId=:room and m.pinnedAt is not null and m.deletedAt is null order by m.pinnedAt desc,m.id desc",
            "room",
            roomId
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
              and message.deletedAt is null
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
