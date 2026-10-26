package com.chisikiroom.common.presentation;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<?> uploadTooLarge() {
        return ResponseEntity.status(413).body(Map.of("message", "File vượt quá giới hạn 20 MB"));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ResponseEntity<?> conflict() {
        return ResponseEntity.status(409).body(
            Map.of("message", "Dữ liệu đã thay đổi hoặc yêu cầu bị trùng. Hãy tải lại và thử lại.")
        );
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(
            Map.of("message", ex.getReason() == null ? "Yêu cầu không hợp lệ" : ex.getReason())
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> invalid(MethodArgumentNotValidException ex) {
        return ResponseEntity.badRequest().body(
            Map.of(
                "message",
                "Dữ liệu chưa hợp lệ: " +
                    ex
                        .getBindingResult()
                        .getFieldErrors()
                        .stream()
                        .map(e -> e.getField() + " " + e.getDefaultMessage())
                        .findFirst()
                        .orElse("kiểm tra thông tin đã nhập")
            )
        );
    }
}
