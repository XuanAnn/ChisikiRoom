package com.chisikiroom.identity.presentation;

import com.chisikiroom.common.security.CurrentUser;
import com.chisikiroom.identity.application.AuthService;
import com.chisikiroom.identity.application.ProfileService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService profiles;

    public ProfileController(ProfileService profiles) {
        this.profiles = profiles;
    }

    public record Update(@NotBlank @Size(min = 2, max = 60) String displayName) {}

    @PutMapping
    public AuthService.Profile update(
        Authentication authentication,
        @Valid @RequestBody Update input
    ) {
        return profiles.update(CurrentUser.id(authentication), input.displayName());
    }

    @PostMapping("/avatar")
    public void upload(Authentication authentication, @RequestParam MultipartFile file)
        throws IOException {
        profiles.validateUploadSize(file.getSize());
        profiles.upload(CurrentUser.id(authentication), file.getBytes());
    }

    @GetMapping("/{id}/avatar")
    public ResponseEntity<Resource> avatar(@PathVariable("id") UUID userId) {
        ProfileService.Avatar avatar = profiles.avatar(userId);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(avatar.contentType()))
            .header("X-Content-Type-Options", "nosniff")
            .cacheControl(CacheControl.noStore())
            .body(new FileSystemResource(avatar.path()));
    }
}
