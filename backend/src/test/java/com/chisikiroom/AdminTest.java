package com.chisikiroom;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.chisikiroom.administration.application.*;
import com.chisikiroom.administration.infrastructure.ClientAddressResolver;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
        "spring.datasource.url=jdbc:h2:mem:admin;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "chisiki.worker.enabled=false",
        "CHISIKI_ADMIN_KEY=admin-test-secret-at-least-32-characters",
    }
)
@AutoConfigureMockMvc
class AdminTest {

    private static final String KEY = "admin-test-secret-at-least-32-characters";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Test
    void adminAuthorizationChatIpsAndSessionRevocation() throws Exception {
        mvc.perform(get("/admin.html")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/snapshot")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/snapshot").header("X-Admin-Key", "wrong")).andExpect(
            status().isForbidden()
        );
        JsonNode account = json.readTree(
            mvc
                .perform(
                    post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            json.writeValueAsBytes(
                                Map.of(
                                    "email",
                                    UUID.randomUUID() + "@example.com",
                                    "password",
                                    "test-password-123",
                                    "displayName",
                                    "Admin test"
                                )
                            )
                        )
                )
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString()
        );
        String token = account.path("token").asText();
        String userId = account.path("user").path("id").asText();
        mvc.perform(
            get("/api/admin/snapshot").header("Authorization", "Bearer " + token)
        ).andExpect(status().isForbidden());
        JsonNode room = json.readTree(
            mvc
                .perform(
                    post("/api/chat-rooms")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Admin room\",\"privateRoom\":false}")
                )
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString()
        );
        mvc.perform(
            post("/api/chat-rooms/" + room.path("id").asText() + "/messages")
                .with(request -> {
                    request.setRemoteAddr("192.168.1.25");
                    return request;
                })
                .header("X-Forwarded-For", "203.0.113.99")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsBytes(
                        Map.of("content", "Hello monitor", "requestId", UUID.randomUUID())
                    )
                )
        ).andExpect(status().isOk());
        String response = mvc
            .perform(get("/api/admin/snapshot").header("X-Admin-Key", KEY))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        JsonNode snapshot = json.readTree(response);
        assertEquals("192.168.1.25", snapshot.path("addresses").path(userId).path("ip").asText());
        JsonNode transfer = snapshot.path("transfers").get(0);
        assertEquals("Hello monitor", transfer.path("summary").asText());
        assertEquals(userId, transfer.path("senderId").asText());
        assertEquals("192.168.1.25", transfer.path("senderIp").asText());
        assertEquals(userId, transfer.path("recipients").get(0).path("userId").asText());
        assertFalse(response.contains(token));
        assertFalse(response.contains("passwordHash"));
        mvc.perform(
            post("/api/admin/users/" + userId + "/revoke-sessions").header("X-Admin-Key", KEY)
        ).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(
            status().isUnauthorized()
        );
    }

    @Test
    void proxyAddressCannotBeSpoofedAndMonitorIsBounded() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.99, 192.168.1.15");
        assertEquals("127.0.0.1", new ClientAddressResolver("").resolve(request));
        assertEquals("192.168.1.15", new ClientAddressResolver("127.0.0.1").resolve(request));
        request.removeHeader("X-Forwarded-For");
        request.addHeader("X-Forwarded-For", ",");
        assertEquals("127.0.0.1", new ClientAddressResolver("127.0.0.1").resolve(request));
        TrafficMonitor monitor = new TrafficMonitor();
        for (int index = 0; index < 600; index++) {
            monitor.record(null, "Server", List.of(), "TEST", "Event");
        }
        assertEquals(500, monitor.transfers().size());
        AdminService disabled = new AdminService(null, monitor, "");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            disabled.authorize("")
        );
    }
}
