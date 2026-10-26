package com.chisikiroom.chat.application;

import com.chisikiroom.chat.infrastructure.persistence.*;
import com.chisikiroom.realtime.application.Events;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ChatService {

    private final ChatRepository repository;
    private final Events events;

    public ChatService(ChatRepository repository, Events events) {
        this.repository = repository;
        this.events = events;
    }

    public record Room(
        UUID id,
        String name,
        boolean privateRoom,
        UUID ownerId,
        boolean joined,
        int memberCount,
        String kind,
        UUID peerId
    ) {}

    public record Member(UUID id, String displayName) {}

    public record ChatMessage(
        long id,
        UUID roomId,
        UUID senderId,
        String displayName,
        String content,
        UUID requestId,
        OffsetDateTime createdAt
    ) {}

    public List<Room> rooms(UUID user) {
        var rows = repository.findVisibleRooms(user);
        return rows
            .stream()
            .map(roomEntity -> view(roomEntity, user))
            .toList();
    }

    private Room view(ChatRoomEntity roomEntity, UUID user) {
        UUID peer = null;
        String name = roomEntity.name;
        if (roomEntity.kind.equals("DIRECT")) {
            var directChatEntry = repository.findDirectChat(roomEntity.id).orElseThrow();
            peer = directChatEntry.userLow.equals(user)
                ? directChatEntry.userHigh
                : directChatEntry.userLow;
            name = repository.findUser(peer).orElseThrow().displayName;
        }
        var members = memberIds(roomEntity.id);
        return new Room(
            roomEntity.id,
            name,
            roomEntity.privateRoom,
            roomEntity.ownerId,
            members.contains(user),
            members.size(),
            roomEntity.kind,
            peer
        );
    }

    public void requireMember(UUID room, UUID user) {
        if (!repository.findMembership(room, user).isPresent()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chưa tham gia phòng này");
        }
    }

    public Room lockRoom(UUID id, UUID user) {
        var roomEntity = repository
            .lockRoom(id)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng")
            );
        return new Room(
            roomEntity.id,
            roomEntity.name,
            roomEntity.privateRoom,
            roomEntity.ownerId,
            false,
            0,
            roomEntity.kind,
            null
        );
    }

    @Transactional
    public Room create(UUID user, String name, boolean privateRoom) {
        var roomEntity = new ChatRoomEntity();
        roomEntity.id = UUID.randomUUID();
        roomEntity.name = name.strip();
        roomEntity.privateRoom = privateRoom;
        roomEntity.ownerId = user;
        repository.insertRoom(roomEntity);
        add(roomEntity.id, user);
        return view(roomEntity, user);
    }

    @Transactional
    public Room direct(UUID user, UUID friend) {
        if (user.equals(friend)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Không thể tự mở chat với chính mình"
            );
        }
        // Let the database establish a consistent UUID ordering, then lock each
        // account in that order on every path that changes this pair.
        var ids = repository.findUserIdsInDatabaseOrder(List.of(user, friend));
        if (ids.size() != 2) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng");
        }
        for (UUID id : ids) {
            repository.lockUser(id).orElseThrow();
        }
        if (repository.findFriendship(user, friend).isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Hai người cần kết bạn trước khi chat riêng"
            );
        }
        UUID low = user.toString().compareTo(friend.toString()) < 0 ? user : friend;
        UUID high = low.equals(user) ? friend : user;
        var prior = repository.findDirectBetween(low, high);
        if (prior.isPresent()) {
            return view(repository.findRoom(prior.get().roomId).orElseThrow(), user);
        }
        var roomEntity = new ChatRoomEntity();
        roomEntity.id = UUID.randomUUID();
        roomEntity.name = "Chat riêng";
        roomEntity.privateRoom = true;
        roomEntity.ownerId = low;
        roomEntity.kind = "DIRECT";
        repository.insertRoom(roomEntity);
        var directChatEntry = new DirectChatEntity();
        directChatEntry.roomId = roomEntity.id;
        directChatEntry.userLow = low;
        directChatEntry.userHigh = high;
        repository.insertDirectChat(directChatEntry);
        add(roomEntity.id, low);
        add(roomEntity.id, high);
        events.send(List.of(low, high), "ROOM_CHANGED", Map.of("roomId", roomEntity.id));
        return view(roomEntity, user);
    }

    @Transactional
    public void join(UUID room, UUID user) {
        Room roomEntity = lockRoom(room, user);
        if (memberIds(room).contains(user)) {
            return;
        }
        if (roomEntity.privateRoom()) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Phòng riêng cần chủ phòng mời"
            );
        }
        addMember(room, user);
    }

    @Transactional
    public void invite(UUID room, UUID owner, UUID user) {
        Room roomEntity = lockRoom(room, owner);
        requireMember(room, owner);
        if (roomEntity.kind().equals("DIRECT")) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Chat bạn bè chỉ dành cho hai người"
            );
        }
        if (!roomEntity.ownerId().equals(owner)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ chủ phòng được mời");
        }
        if (repository.findUser(user).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng");
        }
        if (!memberIds(room).contains(user)) {
            addMember(room, user);
        }
    }

    private void add(UUID room, UUID user) {
        var membership = new RoomMemberEntity();
        membership.roomId = room;
        membership.userId = user;
        repository.insertMembership(membership);
    }

    private void addMember(UUID room, UUID user) {
        add(room, user);
        events.send(memberIds(room), "ROOM_CHANGED", Map.of("roomId", room));
    }

    @Transactional
    public void leave(UUID room, UUID user) {
        Room roomEntity = lockRoom(room, user);
        requireMember(room, user);
        if (roomEntity.kind().equals("DIRECT")) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Không thể rời cuộc trò chuyện bạn bè như một nhóm"
            );
        }
        var members = memberIds(room);
        repository.deleteMembership(repository.findMembership(room, user).orElseThrow());
        repository.flush();
        var remaining = memberIds(room);
        var entity = repository.findRoom(room).orElseThrow();
        if (remaining.isEmpty()) {
            repository.deleteRoom(entity);
        } else if (roomEntity.ownerId().equals(user)) {
            entity.ownerId = remaining.getFirst();
        }
        events.send(members, "ROOM_CHANGED", Map.of("roomId", room));
    }

    public List<UUID> memberIds(UUID room) {
        return repository.findMemberIds(room);
    }

    public List<Member> members(UUID room, UUID user) {
        requireMember(room, user);
        return repository
            .findMemberProfiles(room)
            .stream()
            .map(profile -> new Member(profile.id(), profile.displayName()))
            .toList();
    }

    private ChatMessage message(MessageEntity messageEntity) {
        return new ChatMessage(
            messageEntity.id,
            messageEntity.roomId,
            messageEntity.senderId,
            repository.findUser(messageEntity.senderId).orElseThrow().displayName,
            messageEntity.content,
            messageEntity.requestId,
            messageEntity.createdAt
        );
    }

    public List<ChatMessage> history(UUID room, UUID user, long before) {
        requireMember(room, user);
        var result = new ArrayList<>(
            repository.findHistoryPage(room, before).stream().map(this::message).toList()
        );
        Collections.reverse(result);
        return result;
    }

    @Transactional
    public ChatMessage post(UUID room, UUID user, String content, UUID requestId) {
        lockRoom(room, user);
        requireMember(room, user);
        var prior = repository.findMessageByRequest(user, requestId);
        if (prior.isPresent()) {
            if (!prior.get().roomId.equals(room) || !prior.get().content.equals(content.strip())) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Request ID đã được sử dụng"
                );
            }
            return message(prior.get());
        }
        var messageEntity = new MessageEntity();
        messageEntity.roomId = room;
        messageEntity.senderId = user;
        messageEntity.content = content.strip();
        messageEntity.requestId = requestId;
        repository.insertMessage(messageEntity);
        repository.flush();
        var result = message(messageEntity);
        events.send(memberIds(room), "MESSAGE_CREATED", result);
        return result;
    }

    public List<ChatMessage> search(UUID roomId, UUID userId, String query, long beforeMessageId) {
        requireMember(roomId, userId);
        String normalizedQuery = query.strip();
        if (normalizedQuery.length() < 2 || normalizedQuery.length() > 100) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Nhập từ 2 đến 100 ký tự để tìm tin nhắn"
            );
        }
        String escapedQuery = normalizedQuery
            .toLowerCase(Locale.ROOT)
            .replace("!", "!!")
            .replace("%", "!%")
            .replace("_", "!_");
        return repository
            .searchHistory(roomId, escapedQuery, beforeMessageId)
            .stream()
            .map(this::message)
            .toList();
    }
}
