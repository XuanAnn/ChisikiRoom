package com.chisikiroom;

import static org.junit.jupiter.api.Assertions.*;

import com.chisikiroom.chat.application.ChatService;
import com.chisikiroom.chat.application.DocumentContentPolicy;
import com.chisikiroom.chat.application.DocumentService;
import com.chisikiroom.chat.infrastructure.persistence.DocumentRepository;
import com.chisikiroom.common.infrastructure.storage.UploadStorage;
import com.chisikiroom.identity.application.AuthService;
import com.chisikiroom.identity.application.ProfileService;
import com.chisikiroom.identity.infrastructure.persistence.ProfileRepository;
import com.chisikiroom.realtime.application.Events;
import com.chisikiroom.realtime.application.UserPresence;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
    properties = {
        "spring.datasource.url=jdbc:h2:mem:upload-rollback;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "chisiki.worker.enabled=false",
    }
)
class UploadRollbackTest {

    @TempDir
    Path uploadDirectory;

    @Autowired
    AuthService auth;

    @Autowired
    ChatService chat;

    @Autowired
    DocumentRepository documents;

    @Autowired
    DocumentContentPolicy contentPolicy;

    @Autowired
    ProfileRepository profiles;

    @Autowired
    Events events;

    @Autowired
    UserPresence presence;

    @Autowired
    PlatformTransactionManager transactionManager;

    @Test
    void failedDocumentCommitRollsBackMetadataAndDeletesTheFile() throws Exception {
        UUID userId = account();
        UUID roomId = chat.create(userId, "Upload rollback", true).id();
        UploadStorage storage = new UploadStorage(uploadDirectory.toString());
        DocumentService service = new DocumentService(
            documents,
            chat,
            contentPolicy,
            storage,
            failingCommit(),
            events
        );

        assertThrows(IllegalStateException.class, () ->
            service.upload(userId, roomId, "notes.txt", "Notes".getBytes(StandardCharsets.UTF_8))
        );

        assertTrue(documents.findTop100ByRoomIdOrderByCreatedAtDesc(roomId).isEmpty());
        assertDirectoryEmpty(uploadDirectory);
    }

    @Test
    void failedAvatarCommitRestoresTheProfileAndDeletesTheFile() throws Exception {
        UUID userId = account();
        UploadStorage storage = new UploadStorage(uploadDirectory.toString());
        ProfileService service = new ProfileService(
            profiles,
            storage,
            failingCommit(),
            events,
            presence
        );
        BufferedImage image = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream content = new ByteArrayOutputStream();
        ImageIO.write(image, "png", content);

        assertThrows(IllegalStateException.class, () ->
            service.upload(userId, content.toByteArray())
        );

        var profile = profiles.findById(userId).orElseThrow();
        assertNull(profile.avatarId);
        assertNull(profile.avatarType);
        assertDirectoryEmpty(uploadDirectory.resolve("avatars"));
    }

    private UUID account() {
        return auth
            .register(
                new AuthService.Register(
                    UUID.randomUUID() + "@example.com",
                    "Upload user",
                    "rollback-password-123"
                )
            )
            .user()
            .id();
    }

    /** Fail after the use case succeeds but before the transaction can commit. */
    private TransactionTemplate failingCommit() {
        return new TransactionTemplate(transactionManager) {
            @Override
            public <T> T execute(TransactionCallback<T> callback) {
                return super.execute(status -> {
                    TransactionSynchronizationManager.registerSynchronization(
                        new TransactionSynchronization() {
                            @Override
                            public void beforeCommit(boolean readOnly) {
                                throw new IllegalStateException(
                                    "Simulated metadata commit failure"
                                );
                            }
                        }
                    );
                    return callback.doInTransaction(status);
                });
            }
        };
    }

    private void assertDirectoryEmpty(Path directory) throws Exception {
        try (var files = Files.list(directory)) {
            assertEquals(0, files.count());
        }
    }
}
