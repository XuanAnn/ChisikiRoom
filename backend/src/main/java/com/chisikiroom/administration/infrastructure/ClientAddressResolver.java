package com.chisikiroom.administration.infrastructure;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ClientAddressResolver {

    private final Set<String> trustedProxies;

    public ClientAddressResolver(@Value("${CHISIKI_ADMIN_TRUSTED_PROXIES:}") String configured) {
        trustedProxies = new HashSet<>(Arrays.asList(configured.split(",")));
    }

    public String resolve(HttpServletRequest request) {
        String remote = request.getRemoteAddr();
        String forwarded = request.getHeader("X-Forwarded-For");
        if (!trustedProxies.contains(remote) || forwarded == null || forwarded.length() > 2048) {
            return remote;
        }
        String[] hops = forwarded.split(",", -1);
        String candidate = hops[hops.length - 1].trim();
        // Nginx appends the actual peer to the right; never trust the first supplied value.
        if (candidate.matches("[0-9a-fA-F:.]+") && candidate.length() <= 45) {
            try {
                return java.net.InetAddress.getByName(candidate).getHostAddress();
            } catch (java.net.UnknownHostException ignored) {
                return remote;
            }
        }
        return remote;
    }
}
