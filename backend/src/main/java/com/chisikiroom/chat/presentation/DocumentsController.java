package com.chisikiroom.chat.presentation;

import com.chisikiroom.chat.application.DocumentService;
import com.chisikiroom.common.security.CurrentUser;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documents")
public class DocumentsController {

    private final DocumentService documents;

    public DocumentsController(DocumentService documents) {
        this.documents = documents;
    }

    @GetMapping
    public List<DocumentService.Document> list(
        Authentication authentication,
        @RequestParam UUID roomId
    ) {
        return documents.list(CurrentUser.id(authentication), roomId);
    }

    @PostMapping
    public DocumentService.Document upload(
        Authentication authentication,
        @RequestParam UUID roomId,
        @RequestParam MultipartFile file
    ) throws IOException {
        UUID userId = CurrentUser.id(authentication);
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("");
        // Validate the announced size before allocating the multipart byte array.
        documents.validateUpload(userId, roomId, filename, file.getSize());
        return documents.upload(userId, roomId, filename, file.getBytes());
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(
        Authentication authentication,
        @PathVariable("id") UUID documentId
    ) {
        DocumentService.Download download = documents.download(
            CurrentUser.id(authentication),
            documentId
        );
        String disposition = ContentDisposition.attachment()
            .filename(download.filename(), StandardCharsets.UTF_8)
            .build()
            .toString();
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .header("X-Content-Type-Options", "nosniff")
            .contentLength(download.sizeBytes())
            .body(new FileSystemResource(download.path()));
    }
}
