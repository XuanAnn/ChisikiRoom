package com.chisikiroom.administration.presentation;

import com.chisikiroom.administration.application.AdminService;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService service;

    public AdminController(AdminService service) {
        this.service = service;
    }

    @GetMapping("/snapshot")
    public ResponseEntity<AdminService.Snapshot> snapshot(
        @RequestHeader(value = "X-Admin-Key", required = false) String key
    ) {
        service.authorize(key);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.snapshot());
    }

    @PostMapping("/users/{id}/revoke-sessions")
    public void revoke(
        @RequestHeader(value = "X-Admin-Key", required = false) String key,
        @PathVariable UUID id
    ) {
        service.authorize(key);
        service.revokeSessions(id);
    }
}
