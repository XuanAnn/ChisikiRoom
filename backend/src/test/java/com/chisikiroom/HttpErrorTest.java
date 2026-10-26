package com.chisikiroom;

import static org.junit.jupiter.api.Assertions.*;

import com.chisikiroom.identity.application.AuthService;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:http-errors;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "chisiki.worker.enabled=false",
    }
)
@Import(HttpErrorTest.ErrorProbe.class)
class HttpErrorTest {

    @Autowired
    TestRestTemplate http;

    @RestController
    static class ErrorProbe {

        @GetMapping("/api/test/server-error")
        public void fail() {
            throw new IllegalStateException("Deliberate HTTP error regression test");
        }
    }

    private HttpEntity<?> session() {
        var registered = http.postForEntity(
            "/api/auth/register",
            Map.of(
                "email",
                UUID.randomUUID() + "@example.com",
                "password",
                "regression-password-123",
                "displayName",
                "HTTP regression"
            ),
            AuthService.Session.class
        );
        assertEquals(HttpStatus.CREATED, registered.getStatusCode());
        var headers = new HttpHeaders();
        headers.setBearerAuth(registered.getBody().token());
        return new HttpEntity<>(headers);
    }

    @Test
    void missingEndpointPreserves404AndValidSession() {
        var session = session();
        assertEquals(
            HttpStatus.NOT_FOUND,
            http
                .exchange("/api/does-not-exist", HttpMethod.GET, session, String.class)
                .getStatusCode()
        );
        assertEquals(
            HttpStatus.OK,
            http.exchange("/api/auth/me", HttpMethod.GET, session, String.class).getStatusCode()
        );
    }

    @Test
    void serverFailurePreserves500AndValidSession() {
        var session = session();
        assertEquals(
            HttpStatus.INTERNAL_SERVER_ERROR,
            http
                .exchange("/api/test/server-error", HttpMethod.GET, session, String.class)
                .getStatusCode()
        );
        assertEquals(
            HttpStatus.OK,
            http.exchange("/api/auth/me", HttpMethod.GET, session, String.class).getStatusCode()
        );
    }

    @Test
    void errorDispatchDoesNotMakeProtectedEndpointsPublic() {
        assertEquals(
            HttpStatus.UNAUTHORIZED,
            http.getForEntity("/api/auth/me", String.class).getStatusCode()
        );
        assertEquals(
            HttpStatus.UNAUTHORIZED,
            http.getForEntity("/api/chat-rooms", String.class).getStatusCode()
        );
        assertEquals(
            HttpStatus.UNAUTHORIZED,
            http.getForEntity("/error", String.class).getStatusCode()
        );
    }
}
