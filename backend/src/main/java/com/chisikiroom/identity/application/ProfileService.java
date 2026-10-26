package com.chisikiroom.identity.application;

import com.chisikiroom.common.infrastructure.storage.UploadStorage;
import com.chisikiroom.identity.infrastructure.persistence.ProfileRepository;
import com.chisikiroom.identity.infrastructure.persistence.UserEntity;
import com.chisikiroom.realtime.application.Events;
import com.chisikiroom.realtime.application.UserPresence;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProfileService {

    private static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;
    private final ProfileRepository profiles;
    private final UploadStorage storage;
    private final TransactionTemplate transaction;
    private final Events events;
    private final UserPresence presence;

    public ProfileService(
        ProfileRepository profiles,
        UploadStorage storage,
        TransactionTemplate transaction,
        Events events,
        UserPresence presence
    ) {
        this.profiles = profiles;
        this.storage = storage;
        this.transaction = transaction;
        this.events = events;
        this.presence = presence;
    }

    public record Avatar(Path path, String contentType) {}

    @Transactional
    public AuthService.Profile update(UUID userId, String displayName) {
        String normalizedName = displayName.strip();
        if (normalizedName.length() < 2) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Tên hiển thị cần ít nhất 2 ký tự"
            );
        }
        UserEntity profile = profiles.lockById(userId);
        profile.displayName = normalizedName;
        notifyUsers(userId);
        return new AuthService.Profile(userId, profile.email, normalizedName);
    }

    public void validateUploadSize(long sizeBytes) {
        if (sizeBytes == 0 || sizeBytes > MAX_AVATAR_BYTES) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Avatar tối đa 2 MB, định dạng PNG hoặc JPEG"
            );
        }
    }

    public void upload(UUID userId, byte[] content) throws IOException {
        validateUploadSize(content.length);
        String contentType = detectContentType(content);
        UUID avatarId = UUID.randomUUID();
        storage.writeAvatar(avatarId, content);
        // Execute the metadata commit inside try so failed commits also remove the file.
        try {
            transaction.executeWithoutResult(status -> {
                UserEntity profile = profiles.lockById(userId);
                profile.avatarId = avatarId;
                profile.avatarType = contentType;
                notifyUsers(userId);
            });
        } catch (RuntimeException failure) {
            storage.deleteAvatar(avatarId);
            throw failure;
        }
    }

    @Transactional(readOnly = true)
    public Avatar avatar(UUID userId) {
        UserEntity profile = profiles
            .findById(userId)
            .filter(user -> user.avatarId != null)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Path path = storage.avatarPath(profile.avatarId);
        if (!storage.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return new Avatar(path, profile.avatarType);
    }

    private String detectContentType(byte[] content) {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new IOException();
            }
            var reader = readers.next();
            try {
                reader.setInput(input);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                boolean supportedFormat = Set.of("png", "jpeg", "jpg").contains(format);
                boolean exceedsDimensions = reader.getWidth(0) > 2048 || reader.getHeight(0) > 2048;
                if (!supportedFormat || exceedsDimensions) {
                    throw new IOException();
                }
                if (format.equals("png")) {
                    return "image/png";
                }
                return "image/jpeg";
            } finally {
                reader.dispose();
            }
        } catch (IOException failure) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Avatar cần là PNG/JPEG hợp lệ, tối đa 2048×2048 pixel"
            );
        }
    }

    private void notifyUsers(UUID userId) {
        events.send(presence.onlineUserIds(), "PROFILE_CHANGED", Map.of("userId", userId));
    }
}
