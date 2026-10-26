package com.chisikiroom.identity.infrastructure.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "user_sessions")
public class UserSessionEntity {

    @Id
    @Column(name = "token_hash", nullable = false, length = 64)
    public String tokenHash;

    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "expires_at", nullable = false)
    public OffsetDateTime expiresAt;
}
