package com.chisikiroom.common.security;

import com.chisikiroom.identity.application.AuthService;
import java.util.UUID;
import org.springframework.security.core.Authentication;

public final class CurrentUser {

    private CurrentUser() {}

    public static UUID id(Authentication auth) {
        return ((AuthService.Profile) auth.getPrincipal()).id();
    }
}
