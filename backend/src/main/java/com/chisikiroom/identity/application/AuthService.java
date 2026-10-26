package com.chisikiroom.identity.application;

import com.chisikiroom.identity.infrastructure.persistence.*;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class AuthService {

    private final SessionRepository sessions;
    private final PasswordEncoder passwords;
    private final UserRepository users;

    public AuthService(
        SessionRepository sessions,
        PasswordEncoder passwords,
        UserRepository users
    ) {
        this.sessions = sessions;
        this.passwords = passwords;
        this.users = users;
    }

    public record Register(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 2, max = 60) String displayName,
        @NotBlank @Size(min = 10, max = 72) String password
    ) {}

    public record Login(@NotBlank @Email String email, @NotBlank @Size(max = 72) String password) {}

    public record Profile(UUID id, String email, String displayName) {}

    public record Session(String token, Instant expiresAt, Profile user) {}

    private String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private Profile profile(UserEntity user) {
        return new Profile(user.id, user.email, user.displayName);
    }

    @Transactional
    public Session register(Register input) {
        if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Mật khẩu tối đa 72 byte UTF-8"
            );
        }
        if (input.displayName().strip().length() < 2) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Tên hiển thị cần ít nhất 2 ký tự"
            );
        }
        var user = new UserEntity();
        user.id = UUID.randomUUID();
        user.email = normalize(input.email());
        user.displayName = input.displayName().strip();
        user.passwordHash = passwords.encode(input.password());
        try {
            user = users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }
        return createSession(profile(user));
    }

    @Transactional
    public Session login(Login input) {
        if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Email hoặc mật khẩu không đúng"
            );
        }
        var user = users.findByEmail(normalize(input.email()));
        if (user.isEmpty() || !passwords.matches(input.password(), user.get().passwordHash)) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Email hoặc mật khẩu không đúng"
            );
        }
        return createSession(profile(user.get()));
    }

    private Session createSession(Profile profile) {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiry = Instant.now().plus(Duration.ofDays(7));
        var session = new UserSessionEntity();
        session.tokenHash = hash(token);
        session.userId = profile.id();
        session.expiresAt = expiry.atOffset(ZoneOffset.UTC);
        sessions.save(session);
        return new Session(token, expiry, profile);
    }

    public Optional<Profile> resolve(String token) {
        return sessions.findActiveUser(hash(token), OffsetDateTime.now()).map(this::profile);
    }

    @Transactional
    public void logout(String authorization) {
        sessions.findById(hash(authorization.substring(7))).ifPresent(sessions::delete);
    }
}
