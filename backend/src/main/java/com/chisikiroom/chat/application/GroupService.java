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
public class GroupService {

    private final ChatRepository repository;
    private final ChatService chat;
    private final Events events;

    public GroupService(ChatRepository repository, ChatService chat, Events events) {
        this.repository = repository;
        this.chat = chat;
        this.events = events;
    }

    private ChatService.Room manage(UUID room, UUID user) {
        var target = chat.lockRoom(room, user);
        chat.requireMember(room, user);
        if (!chat.canManage(room, user)) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Bạn không có quyền quản lý nhóm"
            );
        }
        return target;
    }

    private void owner(ChatService.Room room, UUID user) {
        if (!room.ownerId().equals(user)) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Chỉ chủ nhóm được thực hiện thao tác này"
            );
        }
    }

    private void changed(UUID room) {
        events.send(chat.memberIds(room), "ROOM_CHANGED", Map.of("roomId", room));
    }

    @Transactional
    public void update(UUID room, UUID user, String name, boolean privateRoom) {
        var target = manage(room, user);
        if (target.privateRoom() != privateRoom) {
            owner(target, user);
        }
        if (name == null || name.isBlank() || name.strip().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        var entity = repository.findRoom(room).orElseThrow();
        entity.name = name.strip();
        entity.privateRoom = privateRoom;
        changed(room);
    }

    @Transactional
    public void role(UUID room, UUID user, UUID targetUser, String role) {
        var target = manage(room, user);
        owner(target, user);
        if (target.ownerId().equals(targetUser)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Chuyển chủ nhóm trước khi đổi vai trò chủ nhóm"
            );
        }
        if (!Set.of("ADMIN", "MEMBER").contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        repository
            .findMembership(room, targetUser)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND))
            .role = role;
        changed(room);
    }

    @Transactional
    public void transfer(UUID room, UUID user, UUID targetUser) {
        var target = manage(room, user);
        owner(target, user);
        if (targetUser.equals(user)) {
            return;
        }
        var next = repository
            .findMembership(room, targetUser)
            .orElseThrow(() ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Người nhận phải là thành viên nhóm"
                )
            );
        repository.findMembership(room, user).orElseThrow().role = "ADMIN";
        next.role = "MEMBER";
        repository.findRoom(room).orElseThrow().ownerId = targetUser;
        changed(room);
    }

    @Transactional
    public void remove(UUID room, UUID user, UUID targetUser, boolean block) {
        var target = manage(room, user);
        if (targetUser.equals(user) || target.ownerId().equals(targetUser)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Không thể loại chính mình hoặc chủ nhóm"
            );
        }
        var member = repository
            .findMembership(room, targetUser)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (member.role.equals("ADMIN")) {
            owner(target, user);
        }
        repository.deleteMembership(member);
        repository.findInvitation(room, targetUser).ifPresent(repository::deleteInvitation);
        if (block && repository.ban(room, targetUser).isEmpty()) {
            var ban = new GroupBanEntity();
            ban.roomId = room;
            ban.userId = targetUser;
            ban.blockedBy = user;
            repository.insertBan(ban);
        }
        changed(room);
        events.send(List.of(targetUser), "ROOM_CHANGED", Map.of("roomId", room));
        chat.membershipRevoked(room, targetUser);
    }

    public record Ban(
        UUID userId,
        String displayName,
        String blockedBy,
        OffsetDateTime createdAt
    ) {}

    @Transactional
    public List<Ban> bans(UUID room, UUID user) {
        manage(room, user);
        return repository
            .bans(room)
            .stream()
            .map(ban ->
                new Ban(
                    ban.userId,
                    repository.findUser(ban.userId).orElseThrow().displayName,
                    repository.findUser(ban.blockedBy).orElseThrow().displayName,
                    ban.createdAt
                )
            )
            .toList();
    }

    @Transactional
    public void unblock(UUID room, UUID user, UUID targetUser) {
        var target = manage(room, user);
        owner(target, user);
        repository.ban(room, targetUser).ifPresent(repository::deleteBan);
        changed(room);
        events.send(List.of(targetUser), "ROOM_CHANGED", Map.of("roomId", room));
    }
}
