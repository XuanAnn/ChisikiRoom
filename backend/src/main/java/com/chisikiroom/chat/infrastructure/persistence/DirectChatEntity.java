package com.chisikiroom.chat.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "direct_chats")
public class DirectChatEntity {

    @Id
    @Column(name = "room_id", nullable = false)
    public UUID roomId;

    @Column(name = "user_low", nullable = false)
    public UUID userLow;

    @Column(name = "user_high", nullable = false)
    public UUID userHigh;
}
