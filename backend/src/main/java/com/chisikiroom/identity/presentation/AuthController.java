package com.chisikiroom.identity.presentation;

import com.chisikiroom.identity.application.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthService.Session register(@Valid @RequestBody AuthService.Register input) {
        return auth.register(input);
    }

    @PostMapping("/login")
    public AuthService.Session login(@Valid @RequestBody AuthService.Login input) {
        return auth.login(input);
    }

    @GetMapping("/me")
    public AuthService.Profile me(Authentication user) {
        return (AuthService.Profile) user.getPrincipal();
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader("Authorization") String bearer) {
        auth.logout(bearer);
    }
}
