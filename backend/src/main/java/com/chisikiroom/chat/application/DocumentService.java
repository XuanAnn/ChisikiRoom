package com.chisikiroom.chat.application;

import com.chisikiroom.chat.infrastructure.persistence.entity.DocumentEntity;
import com.chisikiroom.chat.infrastructure.persistence.repository.DocumentRepository;
import com.chisikiroom.common.infrastructure.storage.UploadStorage;
import com.chisikiroom.realtime.application.Events;
import java.io.IOException;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentService {

    private final DocumentRepository documents;
    private final ChatService chat;
    private final DocumentContentPolicy contentPolicy;
    private final UploadStorage storage;
    private final TransactionTemplate transaction;
    private final Events events;

    public DocumentService(
        DocumentRepository documents,
        ChatService chat,
        DocumentContentPolicy contentPolicy,
        UploadStorage storage,
        TransactionTemplate transaction,
        Events events
    ) {
        this.documents = documents;
        this.chat = chat;
        this.contentPolicy = contentPolicy;
        this.storage = storage;
        this.transaction = transaction;
        this.events = events;
    }

    public record Document(
        UUID id,
        UUID roomId,
        String filename,
        String contentType,
        long sizeBytes,
        OffsetDateTime createdAt
    ) {}

    public record Download(Path path, String filename, long sizeBytes) {}

    @Transactional(readOnly = true)
    public List<Document> list(UUID userId, UUID roomId) {
        chat.requireMember(roomId, userId);
        return documents
            .findTop100ByRoomIdOrderByCreatedAtDesc(roomId)
            .stream()
            .map(this::toDocument)
            .toList();
    }

    public void validateUpload(UUID userId, UUID roomId, String filename, long sizeBytes) {
        chat.requireMember(roomId, userId);
        contentPolicy.validateUpload(filename, sizeBytes);
    }

    public Document upload(UUID userId, UUID roomId, String filename, byte[] content)
        throws IOException {
        validateUpload(userId, roomId, filename, content.length);
        String contentType = contentPolicy.detectContentType(filename, content);
        UUID documentId = UUID.randomUUID();
        storage.writeDocument(documentId, content);
        // Keep commit inside try: a failed metadata commit must remove the stored file.
        try {
            return transaction.execute(status -> {
                chat.lockRoom(roomId, userId);
                chat.requireMember(roomId, userId);
                DocumentEntity document = new DocumentEntity();
                document.id = documentId;
                document.roomId = roomId;
                document.uploadedBy = userId;
                document.filename = filename;
                document.contentType = contentType;
                document.sizeBytes = (long) content.length;
                DocumentEntity savedDocument = documents.save(document);
                events.send(chat.memberIds(roomId), "DOCUMENT_CREATED", Map.of("roomId", roomId));
                return toDocument(savedDocument);
            });
        } catch (RuntimeException failure) {
            storage.deleteDocument(documentId);
            throw failure;
        }
    }

    @Transactional(readOnly = true)
    public Download download(UUID userId, UUID documentId) {
        DocumentEntity document = documents
            .findById(documentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        chat.requireMember(document.roomId, userId);
        Path path = storage.documentPath(documentId);
        if (!storage.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File không còn trên máy chủ");
        }
        return new Download(path, document.filename, document.sizeBytes);
    }

    private Document toDocument(DocumentEntity document) {
        return new Document(
            document.id,
            document.roomId,
            document.filename,
            document.contentType,
            document.sizeBytes,
            document.createdAt
        );
    }
}
