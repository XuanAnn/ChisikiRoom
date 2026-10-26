package com.chisikiroom.common.infrastructure.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Owns filesystem access; callers use generated IDs, never client-supplied paths. */
@Component
public class UploadStorage {

    private final Path documentDirectory;
    private final Path avatarDirectory;

    public UploadStorage(@Value("${CHISIKI_UPLOAD_DIR:./data/uploads}") String directory) {
        documentDirectory = Path.of(directory).toAbsolutePath().normalize();
        avatarDirectory = documentDirectory.resolve("avatars");
    }

    public Path documentPath(UUID documentId) {
        return documentDirectory.resolve(documentId.toString());
    }

    public Path avatarPath(UUID avatarId) {
        return avatarDirectory.resolve(avatarId.toString());
    }

    public void writeDocument(UUID documentId, byte[] content) throws IOException {
        write(documentPath(documentId), content);
    }

    public void writeAvatar(UUID avatarId, byte[] content) throws IOException {
        write(avatarPath(avatarId), content);
    }

    public void deleteDocument(UUID documentId) throws IOException {
        Files.deleteIfExists(documentPath(documentId));
    }

    public void deleteAvatar(UUID avatarId) throws IOException {
        Files.deleteIfExists(avatarPath(avatarId));
    }

    public boolean exists(Path path) {
        return Files.exists(path);
    }

    private void write(Path target, byte[] content) throws IOException {
        Files.createDirectories(target.getParent());
        Files.write(target, content, StandardOpenOption.CREATE_NEW);
    }
}
