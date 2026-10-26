package com.chisikiroom.identity.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @Column(name = "id", nullable = false)
    public UUID id;

    @Column(name = "email", nullable = false, length = 254)
    public String email;

    @Column(name = "display_name", nullable = false, length = 60)
    public String displayName;

    @Column(name = "password_hash", nullable = false, length = 100)
    public String passwordHash;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "avatar_id")
    public UUID avatarId;

    @Column(name = "avatar_type", length = 30)
    public String avatarType;
}
