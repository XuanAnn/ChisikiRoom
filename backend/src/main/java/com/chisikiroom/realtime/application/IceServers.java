package com.chisikiroom.realtime.application;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class IceServers {

    @Value("${CHISIKI_STUN_URLS:}")
    String stun;

    @Value("${CHISIKI_TURN_URLS:}")
    String turn;

    @Value("${CHISIKI_TURN_SECRET:}")
    String secret;

    public Map<String, Object> forUser(UUID user) {
        var servers = new ArrayList<Map<String, Object>>();
        if (!stun.isBlank()) {
            servers.add(Map.of("urls", Arrays.asList(stun.split(","))));
        }
        if (!turn.isBlank() && !secret.isBlank()) {
            try {
                String username = Instant.now().getEpochSecond() + 3600 + ":" + user;
                Mac mac = Mac.getInstance("HmacSHA1");
                mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
                servers.add(
                    Map.of(
                        "urls",
                        Arrays.asList(turn.split(",")),
                        "username",
                        username,
                        "credential",
                        Base64.getEncoder().encodeToString(
                            mac.doFinal(username.getBytes(StandardCharsets.UTF_8))
                        )
                    )
                );
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
        return Map.of("iceServers", servers);
    }
}
