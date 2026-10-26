package com.chisikiroom.chat.application;

import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** File validation independent of HTTP multipart handling and persistence. */
@Component
public class DocumentContentPolicy {

    public void validateUpload(String filename, long sizeBytes) {
        boolean invalidSize = sizeBytes == 0 || sizeBytes > 20L * 1024 * 1024;
        boolean invalidName =
            filename.isBlank() ||
            filename.length() > 180 ||
            filename.contains("/") ||
            filename.contains("\\") ||
            filename.chars().anyMatch(Character::isISOControl);
        if (invalidSize || invalidName) {
            throw invalid();
        }
    }

    private ResponseStatusException invalid() {
        return new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "File không hợp lệ. Chỉ nhận PDF, DOCX, PPTX, TXT, PNG, JPEG, tối đa 20 MB."
        );
    }

    public String detectContentType(String filename, byte[] bytes) throws IOException {
        String lower = filename.toLowerCase(Locale.ROOT);
        if (
            lower.endsWith(".pdf") &&
            new String(bytes, 0, Math.min(5, bytes.length), StandardCharsets.US_ASCII).equals(
                "%PDF-"
            )
        ) {
            return "application/pdf";
        }
        if (
            lower.endsWith(".png") &&
            bytes.length > 8 &&
            Arrays.equals(Arrays.copyOf(bytes, 8), new byte[] {
                (byte) 137,
                80,
                78,
                71,
                13,
                10,
                26,
                10,
            })
        ) {
            return "image/png";
        }
        if (
            (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) &&
            bytes.length > 3 &&
            (bytes[0] & 255) == 255 &&
            (bytes[1] & 255) == 216 &&
            (bytes[2] & 255) == 255
        ) {
            return "image/jpeg";
        }
        if (lower.endsWith(".txt")) {
            try {
                String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
                if (text.indexOf('\0') < 0) {
                    return "text/plain";
                }
            } catch (CharacterCodingException ignored) {}
        }
        if (lower.endsWith(".docx") || lower.endsWith(".pptx")) {
            boolean types = false;
            boolean body = false;
            int count = 0;
            long total = 0;
            try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
                for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                    if (
                        ++count > 1000 ||
                        entry.getName().contains("..") ||
                        entry.getName().startsWith("/") ||
                        entry.getName().toLowerCase(Locale.ROOT).endsWith("vbaproject.bin")
                    ) {
                        throw invalid();
                    }
                    if (entry.getName().equals("[Content_Types].xml")) {
                        types = true;
                    }
                    if (
                        entry
                            .getName()
                            .equals(
                                lower.endsWith(".docx")
                                    ? "word/document.xml"
                                    : "ppt/presentation.xml"
                            )
                    ) {
                        body = true;
                    }
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        total += read;
                        if (total > 80L * 1024 * 1024) {
                            throw invalid();
                        }
                    }
                }
            }
            if (types && body) {
                return lower.endsWith(".docx")
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            }
        }
        throw invalid();
    }
}
