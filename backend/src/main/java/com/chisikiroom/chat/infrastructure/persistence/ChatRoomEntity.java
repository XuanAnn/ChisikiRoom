package com.chisikiroom.chat.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "chat_rooms")
public class ChatRoomEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "name", nullable = false, length = 80)
    public String name;

    @Column(name = "private_room", nullable = false)
    public boolean privateRoom;

    @Column(name = "owner_id", nullable = false)
    public UUID ownerId;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "kind", nullable = false, length = 10)
    public String kind = "GROUP";
}
