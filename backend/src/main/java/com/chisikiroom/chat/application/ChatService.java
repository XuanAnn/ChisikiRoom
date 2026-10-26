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

    public ChatService(
        ChatRepository repository,
        Events events,
        org.springframework.context.ApplicationEventPublisher publisher
    ) {
        this.repository = repository;
        this.events = events;
        this.publisher = publisher;
    }

    public record Room(
        UUID id,
        String name,
        boolean privateRoom,
        UUID ownerId,
        boolean joined,
        int memberCount,
        String kind,
        UUID peerId,
        String myRole
    ) {}

    public record Member(UUID id, String displayName, String role) {}

    public record Reply(
        long id,
        String displayName,
        String content,
        boolean deleted,
        long revision
    ) {}

    public record ChatMessage(
        long id,
        UUID roomId,
        UUID senderId,
        String displayName,
        String content,
        UUID requestId,
        OffsetDateTime createdAt,
        OffsetDateTime editedAt,
        OffsetDateTime deletedAt,
        OffsetDateTime pinnedAt,
        Reply reply,
        long revision
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
            peer,
            role(roomEntity.id, user, roomEntity.ownerId)
        );
    }

    private String role(UUID room, UUID user, UUID owner) {
        if (user == null) {
            return null;
        }
        return repository
            .findMembership(room, user)
            .map(member -> owner.equals(user) ? "OWNER" : member.role)
            .orElse(null);
    }

    public boolean canManage(UUID room, UUID user) {
        var target = repository
            .findRoom(room)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String role = role(room, user, target.ownerId);
        return !target.kind.equals("DIRECT") && ("OWNER".equals(role) || "ADMIN".equals(role));
    }

    public void requireNotBlocked(UUID room, UUID user) {
        if (repository.ban(room, user).isPresent()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn đã bị chặn khỏi nhóm");
        }
    }

    public record MembershipRevoked(UUID roomId, UUID userId) {}

    private final org.springframework.context.ApplicationEventPublisher publisher;

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
        if (roomEntity.archived && user != null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nhóm đã đóng");
        }
        return new Room(
            roomEntity.id,
            roomEntity.name,
            roomEntity.privateRoom,
            roomEntity.ownerId,
            false,
            0,
            roomEntity.kind,
            null,
            role(roomEntity.id, user, roomEntity.ownerId)
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
        requireNotBlocked(room, user);
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
        if (!canManage(room, owner)) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Chỉ chủ nhóm hoặc quản trị viên được mời"
            );
        }
        if (repository.findUser(user).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng");
        }
        requireNotBlocked(room, user);
        if (!memberIds(room).contains(user) && repository.findInvitation(room, user).isEmpty()) {
            GroupInvitationEntity invitation = new GroupInvitationEntity();
            invitation.roomId = room;
            invitation.userId = user;
            invitation.inviterId = owner;
            repository.insertInvitation(invitation);
            events.send(List.of(user), "GROUP_INVITED", Map.of("roomId", room));
        }
    }

    public record GroupInvitation(
        UUID roomId,
        String roomName,
        String inviterName,
        OffsetDateTime createdAt
    ) {}

    public List<GroupInvitation> invitations(UUID user) {
        return repository
            .invitations(user)
            .stream()
            .map(invitation ->
                new GroupInvitation(
                    invitation.roomId(),
                    invitation.roomName(),
                    invitation.inviterName(),
                    invitation.createdAt()
                )
            )
            .toList();
    }

    @Transactional
    public void respondInvitation(UUID room, UUID user, boolean accept) {
        Room target = lockRoom(room, user);
        requireNotBlocked(room, user);
        Optional<GroupInvitationEntity> invitation = repository.findInvitation(room, user);
        if (invitation.isEmpty()) {
            if (accept && repository.findMembership(room, user).isPresent()) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lời mời nhóm");
        }
        if (target.kind().equals("DIRECT")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
        if (accept && repository.findMembership(room, user).isEmpty()) {
            addMember(room, user);
        } else {
            repository.deleteInvitation(invitation.get());
        }
        events.send(
            List.of(user, target.ownerId()),
            "GROUP_INVITATION_CHANGED",
            Map.of("roomId", room)
        );
    }

    private void add(UUID room, UUID user) {
        var membership = new RoomMemberEntity();
        membership.roomId = room;
        membership.userId = user;
        repository.insertMembership(membership);
    }

    private void addMember(UUID room, UUID user) {
        repository.findInvitation(room, user).ifPresent(repository::deleteInvitation);
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
            entity.archived = true;
        } else if (roomEntity.ownerId().equals(user)) {
            var candidates = repository.findMemberProfiles(room);
            entity.ownerId = candidates
                .stream()
                .filter(member -> member.role().equals("ADMIN"))
                .findFirst()
                .orElse(candidates.getFirst())
                .id();
            repository.findMembership(room, entity.ownerId).orElseThrow().role = "MEMBER";
        }
        events.send(members, "ROOM_CHANGED", Map.of("roomId", room));
        membershipRevoked(room, user);
    }

    public void membershipRevoked(UUID room, UUID user) {
        events.send(List.of(user), "ROOM_MEMBERSHIP_REVOKED", Map.of("roomId", room));
        publisher.publishEvent(new MembershipRevoked(room, user));
    }

    public List<UUID> memberIds(UUID room) {
        return repository.findMemberIds(room);
    }

    public List<Member> members(UUID room, UUID user) {
        requireMember(room, user);
        UUID owner = repository.findRoom(room).orElseThrow().ownerId;
        return repository
            .findMemberProfiles(room)
            .stream()
            .map(profile ->
                new Member(
                    profile.id(),
                    profile.displayName(),
                    profile.id().equals(owner) ? "OWNER" : profile.role()
                )
            )
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
            messageEntity.createdAt,
            messageEntity.editedAt,
            messageEntity.deletedAt,
            messageEntity.pinnedAt,
            messageEntity.deletedAt == null ? reply(messageEntity) : null,
            messageEntity.revision
        );
    }

    private Reply reply(MessageEntity message) {
        if (message.replyToId == null) {
            return null;
        }
        return repository
            .findMessage(message.replyToId, message.roomId)
            .map(parent ->
                new Reply(
                    parent.id,
                    repository.findUser(parent.senderId).orElseThrow().displayName,
                    parent.deletedAt == null ? parent.content : "",
                    parent.deletedAt != null,
                    parent.revision
                )
            )
            .orElse(null);
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
        return post(room, user, content, requestId, null);
    }

    @Transactional
    public ChatMessage post(UUID room, UUID user, String content, UUID requestId, Long replyToId) {
        lockRoom(room, user);
        requireMember(room, user);
        var prior = repository.findMessageByRequest(user, requestId);
        if (prior.isPresent()) {
            if (
                !prior.get().roomId.equals(room) ||
                !prior.get().content.equals(content.strip()) ||
                !Objects.equals(prior.get().replyToId, replyToId)
            ) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Request ID đã được sử dụng"
                );
            }
            return message(prior.get());
        }
        if (replyToId != null) {
            MessageEntity parent = repository
                .findMessage(replyToId, room)
                .orElseThrow(() ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy tin được trả lời"
                    )
                );
            if (parent.deletedAt != null) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Tin được trả lời đã bị xóa"
                );
            }
        }
        var messageEntity = new MessageEntity();
        messageEntity.replyToId = replyToId;
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

    private MessageEntity editable(UUID room, UUID user, long id, boolean moderation) {
        Room target = lockRoom(room, user);
        requireMember(room, user);
        MessageEntity message = repository
            .findMessage(id, room)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean moderator = false;
        if (moderation && !target.kind().equals("DIRECT") && canManage(room, user)) {
            String senderRole = role(room, message.senderId, target.ownerId());
            moderator =
                target.ownerId().equals(user) ||
                (!"OWNER".equals(senderRole) && !"ADMIN".equals(senderRole));
        }
        if (!message.senderId.equals(user) && !moderator) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Chỉ được sửa hoặc xóa tin của mình"
            );
        }
        return message;
    }

    @Transactional
    public ChatMessage edit(UUID room, UUID user, long id, String content) {
        MessageEntity message = editable(room, user, id, false);
        if (message.deletedAt != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tin nhắn đã bị xóa");
        }
        if (content == null || content.isBlank() || content.strip().length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        if (!message.content.equals(content.strip())) {
            message.content = content.strip();
            message.revision++;
            message.editedAt = OffsetDateTime.now().truncatedTo(
                java.time.temporal.ChronoUnit.MICROS
            );
            events.send(memberIds(room), "MESSAGE_CHANGED", message(message));
        }
        return message(message);
    }

    @Transactional
    public ChatMessage delete(UUID room, UUID user, long id) {
        MessageEntity message = editable(room, user, id, true);
        if (message.deletedAt == null) {
            message.content = "";
            message.revision++;
            message.deletedAt = OffsetDateTime.now().truncatedTo(
                java.time.temporal.ChronoUnit.MICROS
            );
            message.pinnedAt = null;
            events.send(memberIds(room), "MESSAGE_CHANGED", message(message));
        }
        return message(message);
    }

    public List<ChatMessage> pinned(UUID room, UUID user) {
        requireMember(room, user);
        return repository.pinned(room).stream().map(this::message).toList();
    }

    @Transactional
    public ChatMessage pin(UUID room, UUID user, long id, boolean pinned) {
        Room target = lockRoom(room, user);
        requireMember(room, user);
        if (!target.kind().equals("DIRECT") && !canManage(room, user)) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Chỉ chủ nhóm hoặc quản trị viên được ghim tin"
            );
        }
        MessageEntity message = repository
            .findMessage(id, room)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (message.deletedAt != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thể ghim tin đã xóa");
        }
        if (pinned == (message.pinnedAt != null)) {
            return message(message);
        }
        message.revision++;
        if (pinned && message.pinnedAt == null && repository.pinned(room).size() >= 5) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mỗi phòng tối đa 5 tin ghim");
        }
        if (pinned && message.pinnedAt == null) {
            message.pinnedAt = OffsetDateTime.now().truncatedTo(
                java.time.temporal.ChronoUnit.MICROS
            );
        }
        if (!pinned) {
            message.pinnedAt = null;
        }
        events.send(memberIds(room), "MESSAGE_CHANGED", message(message));
        return message(message);
    }

    public record State(
        UUID roomId,
        String draft,
        long draftVersion,
        long lastReadId,
        long unreadCount
    ) {}

    private State state(RoomMemberEntity member) {
        return new State(
            member.roomId,
            member.draft,
            member.draftVersion,
            member.lastReadId,
            repository.unread(member.roomId, member.userId, member.lastReadId)
        );
    }

    public List<State> states(UUID user) {
        return repository.memberships(user).stream().map(this::state).toList();
    }

    @Transactional
    public State saveDraft(UUID room, UUID user, String content, long expectedVersion) {
        lockRoom(room, user);
        requireMember(room, user);
        RoomMemberEntity member = repository.findMembership(room, user).orElseThrow();
        if (member.draftVersion != expectedVersion) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "DRAFT_CONFLICT: Bản nháp đã thay đổi trên máy khác"
            );
        }
        if (content == null || content.length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        if (!member.draft.equals(content)) {
            member.draft = content;
            member.draftVersion++;
        }
        return state(member);
    }

    @Transactional
    public State markRead(UUID room, UUID user, long lastReadId) {
        lockRoom(room, user);
        requireMember(room, user);
        if (lastReadId > 0 && repository.findMessage(lastReadId, room).isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Tin nhắn không thuộc phòng này"
            );
        }
        RoomMemberEntity member = repository.findMembership(room, user).orElseThrow();
        member.lastReadId = Math.max(member.lastReadId, lastReadId);
        return state(member);
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
