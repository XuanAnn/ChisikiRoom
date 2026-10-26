package com.chisikiroom.community.infrastructure.persistence.entity;

import com.chisikiroom.community.infrastructure.persistence.key.FriendshipId;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "friendships")
@IdClass(FriendshipId.class)
public class FriendshipEntity {

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Id
    @Column(name = "friend_id", nullable = false)
    public UUID friendId;
}
