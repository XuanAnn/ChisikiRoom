package com.chisikiroom;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.chisikiroom.battle.application.BattleService;
import com.chisikiroom.chat.application.ChatService;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;

@SpringBootTest(
    properties = {
        "spring.datasource.url=jdbc:h2:mem:chisiki;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "chisiki.worker.enabled=false",
        "CHISIKI_UPLOAD_DIR=${java.io.tmpdir}/chisikiroom-unit-tests",
    }
)
@AutoConfigureMockMvc
class ApplicationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    BattleService battles;

    @Autowired
    ChatService chatService;

    @Autowired
    TestClock clock;

    @Autowired
    com.chisikiroom.common.infrastructure.JpaStore store;

    @Autowired
    org.springframework.transaction.support.TransactionTemplate transaction;

    static class TestClock extends java.time.Clock {

        final java.util.concurrent.atomic.AtomicReference<java.time.Instant> time =
            new java.util.concurrent.atomic.AtomicReference<>(
                java.time.Instant.parse("2026-10-24T12:00:00Z")
            );

        public java.time.ZoneId getZone() {
            return java.time.ZoneOffset.UTC;
        }

        public java.time.Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        public java.time.Instant instant() {
            return time.get();
        }

        void advance(long seconds) {
            time.updateAndGet(t -> t.plusSeconds(seconds));
        }
    }

    @org.springframework.boot.test.context.TestConfiguration
    static class TimeConfig {

        @org.springframework.context.annotation.Bean
        @org.springframework.context.annotation.Primary
        TestClock testClock() {
            return new TestClock();
        }
    }

    record Account(String token, String id, String email) {}

    Account account() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        var result = call(
            "POST",
            "/api/auth/register",
            null,
            Map.of("email", email, "password", "test-password-123", "displayName", "Test User"),
            201
        );
        return new Account(
            result.path("token").asText(),
            result.path("user").path("id").asText(),
            email
        );
    }

    JsonNode call(String method, String path, String token, Object body, int expected)
        throws Exception {
        var request = request(org.springframework.http.HttpMethod.valueOf(method), path);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));
        }
        var response = mvc
            .perform(request)
            .andExpect(status().is(expected))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return response.isBlank() ? json.nullNode() : json.readTree(response);
    }

    String room(Account a, boolean privateRoom) throws Exception {
        return call(
            "POST",
            "/api/chat-rooms",
            a.token(),
            Map.of("name", "Test room", "privateRoom", privateRoom),
            200
        )
            .path("id")
            .asText();
    }

    @Test
    void ormRollsBackDirtyEntitiesAndNewRowsTogether() throws Exception {
        var account = account();
        UUID user = UUID.fromString(account.id());
        String hash = UUID.randomUUID().toString();
        assertThrows(IllegalStateException.class, () ->
            transaction.executeWithoutResult(status -> {
                store
                    .find(
                        com.chisikiroom.identity.infrastructure.persistence.UserEntity.class,
                        user
                    )
                    .orElseThrow()
                    .displayName = "Must roll back";
                var session =
                    new com.chisikiroom.identity.infrastructure.persistence.UserSessionEntity();
                session.tokenHash = hash;
                session.userId = user;
                session.expiresAt = java.time.OffsetDateTime.now().plusDays(1);
                store.insert(session);
                store.flush();
                throw new IllegalStateException("Force rollback after flush");
            })
        );
        transaction.executeWithoutResult(status -> {
            assertEquals(
                "Test User",
                store
                    .find(
                        com.chisikiroom.identity.infrastructure.persistence.UserEntity.class,
                        user
                    )
                    .orElseThrow()
                    .displayName
            );
            assertTrue(
                store
                    .find(
                        com.chisikiroom.identity.infrastructure.persistence.UserSessionEntity.class,
                        hash
                    )
                    .isEmpty()
            );
        });
        call(
            "POST",
            "/api/auth/register",
            null,
            Map.of(
                "email",
                account.email(),
                "password",
                "test-password-123",
                "displayName",
                "Duplicate"
            ),
            409
        );
    }

    @Test
    void ormAggregateLockRefreshesAnEntityCachedBeforeAnotherCommit() throws Exception {
        var account = account();
        UUID id = UUID.fromString(account.id());
        var cached = new java.util.concurrent.CountDownLatch(1);
        var committed = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var reader = pool.submit(() ->
                transaction.execute(status -> {
                    assertEquals(
                        "Test User",
                        store
                            .find(
                                com.chisikiroom.identity.infrastructure.persistence.UserEntity.class,
                                id
                            )
                            .orElseThrow()
                            .displayName
                    );
                    cached.countDown();
                    try {
                        assertTrue(committed.await(10, java.util.concurrent.TimeUnit.SECONDS));
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                    return store
                        .lock(
                            com.chisikiroom.identity.infrastructure.persistence.UserEntity.class,
                            id
                        )
                        .orElseThrow()
                        .displayName;
                })
            );
            var writer = pool.submit(() -> {
                try {
                    assertTrue(cached.await(10, java.util.concurrent.TimeUnit.SECONDS));
                    transaction.executeWithoutResult(
                        status ->
                            store
                                .lock(
                                    com.chisikiroom.identity.infrastructure.persistence.UserEntity.class,
                                    id
                                )
                                .orElseThrow()
                                .displayName = "Committed name"
                    );
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                } finally {
                    committed.countDown();
                }
            });
            writer.get();
            assertEquals("Committed name", reader.get());
        }
    }

    @Test
    void authLifecycle() throws Exception {
        var a = account();
        call(
            "POST",
            "/api/auth/login",
            null,
            Map.of("email", a.email(), "password", "incorrect"),
            401
        );
        var login = call(
            "POST",
            "/api/auth/login",
            null,
            Map.of("email", a.email(), "password", "test-password-123"),
            200
        );
        String token = login.path("token").asText();
        assertEquals(a.id(), call("GET", "/api/auth/me", token, null, 200).path("id").asText());
        call("POST", "/api/auth/logout", token, null, 204);
        call("GET", "/api/auth/me", token, null, 401);
    }

    @Test
    void messageSearchChecksMembershipEscapesWildcardsAndPaginates() throws Exception {
        var owner = account();
        var outsider = account();
        String roomId = room(owner, true);
        for (int index = 0; index < 55; index++) {
            call(
                "POST",
                "/api/chat-rooms/" + roomId + "/messages",
                owner.token(),
                Map.of("content", "Search needle " + index, "requestId", UUID.randomUUID()),
                200
            );
        }
        String searchPath = "/api/chat-rooms/" + roomId + "/messages/search";
        call("GET", searchPath + "?q=needle", outsider.token(), null, 403);
        call("GET", searchPath + "?q=x", owner.token(), null, 400);
        var firstPage = call("GET", searchPath + "?q=NEEDLE", owner.token(), null, 200);
        assertEquals(50, firstPage.size());
        long before = firstPage.get(49).path("id").asLong();
        var secondPage = call(
            "GET",
            searchPath + "?q=needle&before=" + before,
            owner.token(),
            null,
            200
        );
        assertEquals(5, secondPage.size());
        assertTrue(secondPage.get(0).path("id").asLong() < before);
        call(
            "POST",
            "/api/chat-rooms/" + roomId + "/messages",
            owner.token(),
            Map.of("content", "100% kế hoạch", "requestId", UUID.randomUUID()),
            200
        );
        var percent = mvc
            .perform(
                get(searchPath)
                    .param("q", "100%")
                    .header("Authorization", "Bearer " + owner.token())
            )
            .andExpect(status().isOk())
            .andReturn();
        assertEquals(1, json.readTree(percent.getResponse().getContentAsString()).size());
        var underscore = mvc
            .perform(
                get(searchPath)
                    .param("q", "__")
                    .header("Authorization", "Bearer " + owner.token())
            )
            .andExpect(status().isOk())
            .andReturn();
        assertEquals(0, json.readTree(underscore.getResponse().getContentAsString()).size());
    }

    @Test
    void privateRoomRequiresInviteAndHandsOverOwner() throws Exception {
        var owner = account();
        var guest = account();
        var stranger = account();
        String id = room(owner, true);
        assertTrue(
            call("GET", "/api/chat-rooms", stranger.token(), null, 200)
                .findValuesAsText("id")
                .stream()
                .noneMatch(id::equals)
        );
        call("POST", "/api/chat-rooms/" + id + "/join", guest.token(), null, 403);
        call("GET", "/api/chat-rooms/" + id + "/messages", guest.token(), null, 403);
        call(
            "POST",
            "/api/chat-rooms/" + id + "/invite",
            owner.token(),
            Map.of("userId", guest.id()),
            200
        );
        call(
            "POST",
            "/api/chat-rooms/" + id + "/invite",
            guest.token(),
            Map.of("userId", stranger.id()),
            403
        );
        call("GET", "/api/chat-rooms/" + id + "/members", guest.token(), null, 200);
        call("POST", "/api/chat-rooms/" + id + "/leave", owner.token(), null, 200);
        var rooms = call("GET", "/api/chat-rooms", guest.token(), null, 200);
        for (var r : rooms) {
            if (r.path("id").asText().equals(id)) {
                assertEquals(guest.id(), r.path("ownerId").asText());
            }
        }
        call("GET", "/api/chat-rooms/" + id + "/messages", owner.token(), null, 403);
    }

    @Test
    void messagesAreIdempotentAndPrivate() throws Exception {
        var a = account();
        var b = account();
        String id = room(a, false);
        String requestId = UUID.randomUUID().toString();
        var body = Map.of("content", "Xin chào 👋", "requestId", requestId);
        var first = call("POST", "/api/chat-rooms/" + id + "/messages", a.token(), body, 200);
        assertEquals(
            first.path("id"),
            call("POST", "/api/chat-rooms/" + id + "/messages", a.token(), body, 200).path("id")
        );
        call(
            "POST",
            "/api/chat-rooms/" + id + "/messages",
            a.token(),
            Map.of("content", "changed", "requestId", requestId),
            409
        );
        call(
            "POST",
            "/api/chat-rooms/" + id + "/messages",
            b.token(),
            Map.of("content", "not joined", "requestId", UUID.randomUUID()),
            403
        );
        call("POST", "/api/chat-rooms/" + id + "/join", b.token(), null, 200);
        assertEquals(
            1,
            call("GET", "/api/chat-rooms/" + id + "/messages", b.token(), null, 200).size()
        );
    }

    @Test
    void historyUsesStablePages() throws Exception {
        var a = account();
        String id = room(a, false);
        for (int i = 0; i < 55; i++) {
            call(
                "POST",
                "/api/chat-rooms/" + id + "/messages",
                a.token(),
                Map.of("content", "Message " + i, "requestId", UUID.randomUUID()),
                200
            );
        }
        var latest = call("GET", "/api/chat-rooms/" + id + "/messages", a.token(), null, 200);
        assertEquals(50, latest.size());
        assertEquals("Message 5", latest.get(0).path("content").asText());
        var older = call(
            "GET",
            "/api/chat-rooms/" + id + "/messages?before=" + latest.get(0).path("id").asLong(),
            a.token(),
            null,
            200
        );
        assertEquals(5, older.size());
        assertEquals("Message 0", older.get(0).path("content").asText());
    }

    @Test
    void quizzesAreOwnerOnlyAndValidateAnswers() throws Exception {
        var a = account();
        var b = account();
        var body = Map.of(
            "title",
            "Khoa học",
            "questions",
            List.of(Map.of("text", "1 + 1?", "options", List.of("2", "3"), "correctIndex", 0))
        );
        String id = call("POST", "/api/question-sets", a.token(), body, 200).path("id").asText();
        call("GET", "/api/question-sets/" + id, b.token(), null, 404);
        call("PUT", "/api/question-sets/" + id, b.token(), body, 404);
        call("PUT", "/api/question-sets/" + id, a.token(), body, 200);
        call(
            "POST",
            "/api/question-sets",
            a.token(),
            Map.of(
                "title",
                "Invalid",
                "questions",
                List.of(Map.of("text", "?", "options", List.of("A", "B"), "correctIndex", 3))
            ),
            400
        );
    }

    @Autowired
    com.chisikiroom.quiz.infrastructure.QuizCatalogInitializer catalogInitializer;

    @Test
    void builtInJapaneseQuizzesAreSharedImmutableAndSeededOnce() throws Exception {
        var first = account();
        var second = account();
        var initial = call("GET", "/api/question-sets", first.token(), null, 200);
        var shared = new ArrayList<JsonNode>();
        for (JsonNode quiz : initial) {
            if (quiz.path("ownerId").isNull()) {
                shared.add(quiz);
            }
        }
        assertEquals(10, shared.size());
        assertEquals(
            5,
            shared
                .stream()
                .filter(quiz -> quiz.path("title").asText().startsWith("N5"))
                .count()
        );
        assertEquals(
            5,
            shared
                .stream()
                .filter(quiz -> quiz.path("title").asText().startsWith("N4"))
                .count()
        );
        for (JsonNode quiz : shared) {
            assertEquals(10, quiz.path("questions").size());
            for (JsonNode question : quiz.path("questions")) {
                assertFalse(question.path("text").asText().isBlank());
                assertEquals(4, question.path("options").size());
                int correctIndex = question.path("correctIndex").asInt();
                assertTrue(correctIndex >= 0 && correctIndex < 4);
                Set<String> uniqueOptions = new HashSet<>();
                for (JsonNode option : question.path("options")) {
                    assertFalse(option.asText().isBlank());
                    uniqueOptions.add(option.asText());
                }
                assertEquals(4, uniqueOptions.size());
            }
        }
        JsonNode template = shared.getFirst();
        String templateId = template.path("id").asText();
        assertEquals(
            template,
            call("GET", "/api/question-sets/" + templateId, second.token(), null, 200)
        );
        var copyInput = Map.of(
            "title",
            "My Japanese copy",
            "questions",
            template.path("questions")
        );
        call("PUT", "/api/question-sets/" + templateId, first.token(), copyInput, 404);
        var copy = call("POST", "/api/question-sets", first.token(), copyInput, 200);
        assertEquals(first.id(), copy.path("ownerId").asText());
        assertNotEquals(templateId, copy.path("id").asText());
        call("GET", "/api/question-sets/" + copy.path("id").asText(), second.token(), null, 404);
        catalogInitializer.run(
            new org.springframework.boot.DefaultApplicationArguments(new String[0])
        );
        var after = call("GET", "/api/question-sets", first.token(), null, 200);
        assertEquals(11, after.size());
        assertEquals(
            template,
            call("GET", "/api/question-sets/" + templateId, first.token(), null, 200)
        );
    }

    @Test
    void builtInJapaneseQuizCanStartBattleWithoutCopying() throws Exception {
        var host = account();
        var guest = account();
        String roomId = room(host, false);
        call("POST", "/api/chat-rooms/" + roomId + "/join", guest.token(), null, 200);
        UUID quizId = UUID.fromString("9e590000-0000-4000-8000-000000000001");
        UUID hostId = UUID.fromString(host.id());
        UUID guestId = UUID.fromString(guest.id());
        var battle = battles.create(UUID.fromString(roomId), quizId, hostId);
        battles.join(battle.id(), guestId);
        battles.heartbeat(battle.id(), hostId, true, true);
        battles.heartbeat(battle.id(), guestId, true, true);
        battles.start(battle.id(), hostId);
        var snapshot = battles.snapshot(battle.id(), hostId);
        assertEquals("IN_PROGRESS", snapshot.status());
        assertEquals(10, snapshot.totalQuestions());
        assertTrue(snapshot.title().startsWith("N5"));
        assertNotNull(snapshot.round());
        assertNull(snapshot.round().correctIndex());
    }

    record Match(Account a, Account b, UUID id, UUID quiz) {}

    Match match() throws Exception {
        var a = account();
        var b = account();
        String room = room(a, false);
        call("POST", "/api/chat-rooms/" + room + "/join", b.token(), null, 200);
        var input = Map.of(
            "title",
            "Battle test",
            "questions",
            List.of(
                Map.of("text", "One?", "options", List.of("A", "B"), "correctIndex", 0),
                Map.of("text", "Original two?", "options", List.of("A", "B"), "correctIndex", 1)
            )
        );
        UUID quiz = UUID.fromString(
            call("POST", "/api/question-sets", a.token(), input, 200).path("id").asText()
        );
        var battle = battles.create(UUID.fromString(room), quiz, UUID.fromString(a.id()));
        battles.join(battle.id(), UUID.fromString(b.id()));
        battles.heartbeat(battle.id(), UUID.fromString(a.id()), true, true);
        battles.heartbeat(battle.id(), UUID.fromString(b.id()), true, true);
        battles.start(battle.id(), UUID.fromString(a.id()));
        return new Match(a, b, battle.id(), quiz);
    }

    @Test
    void simultaneousCorrectAnswersHaveOneWinnerAndOneScoreChange() throws Exception {
        var m = match();
        var round = battles.snapshot(m.id(), UUID.fromString(m.a().id())).round();
        assertNull(round.correctIndex());
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var tasks = List.of(m.a(), m.b())
                .stream()
                .map(a ->
                    pool.submit(() -> {
                        gate.await();
                        try {
                            battles.answer(
                                m.id(),
                                UUID.fromString(a.id()),
                                round.id(),
                                0,
                                UUID.randomUUID()
                            );
                            return true;
                        } catch (org.springframework.web.server.ResponseStatusException e) {
                            return false;
                        }
                    })
                )
                .toList();
            gate.countDown();
            int wins = 0;
            for (var task : tasks) {
                if (task.get()) {
                    wins++;
                }
            }
            assertEquals(1, wins);
        }
        var result = battles.snapshot(m.id(), UUID.fromString(m.a().id()));
        assertEquals("RESOLVED", result.round().status());
        assertEquals(
            List.of(-5, 10),
            result.players().stream().map(BattleService.Player::score).sorted().toList()
        );
        battles.tick(m.id());
        assertEquals(
            List.of(-5, 10),
            battles
                .snapshot(m.id(), UUID.fromString(m.a().id()))
                .players()
                .stream()
                .map(BattleService.Player::score)
                .sorted()
                .toList()
        );
    }

    @Test
    void wrongAnswerCannotRetryAndTimeoutDoesNotChangeScores() throws Exception {
        var m = match();
        UUID a = UUID.fromString(m.a().id());
        var r = battles.snapshot(m.id(), a).round();
        UUID request = UUID.randomUUID();
        battles.answer(m.id(), a, r.id(), 1, request);
        battles.answer(m.id(), a, r.id(), 1, request);
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            battles.answer(m.id(), a, r.id(), 0, UUID.randomUUID())
        );
        clock.advance(16);
        battles.tick(m.id());
        var result = battles.snapshot(m.id(), a);
        assertEquals("TIMEOUT", result.round().reason());
        assertTrue(
            result
                .players()
                .stream()
                .allMatch(p -> p.score() == 0)
        );
        assertEquals(0, result.round().correctIndex());
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            battles.answer(m.id(), UUID.fromString(m.b().id()), r.id(), 0, UUID.randomUUID())
        );
    }

    @Test
    void quizSnapshotAndResultDelaySurviveRepeatedTicks() throws Exception {
        var m = match();
        UUID a = UUID.fromString(m.a().id());
        var r = battles.snapshot(m.id(), a).round();
        call(
            "PUT",
            "/api/question-sets/" + m.quiz(),
            m.a().token(),
            Map.of(
                "title",
                "Modified",
                "questions",
                List.of(Map.of("text", "Changed", "options", List.of("X", "Y"), "correctIndex", 0))
            ),
            200
        );
        battles.answer(m.id(), a, r.id(), 0, UUID.randomUUID());
        clock.advance(1);
        battles.tick(m.id());
        assertEquals(1, battles.snapshot(m.id(), a).round().number());
        clock.advance(1);
        battles.tick(m.id());
        battles.tick(m.id());
        var next = battles.snapshot(m.id(), a);
        assertEquals(2, next.round().number());
        assertEquals("Original two?", next.round().text());
        assertNull(next.round().correctIndex());
    }

    @Test
    void cameraLossBlocksAnswersAndForfeitsAfterGrace() throws Exception {
        var m = match();
        UUID a = UUID.fromString(m.a().id());
        UUID b = UUID.fromString(m.b().id());
        var r = battles.snapshot(m.id(), a).round();
        battles.heartbeat(m.id(), a, false, false);
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
            battles.answer(m.id(), a, r.id(), 0, UUID.randomUUID())
        );
        clock.advance(20);
        battles.heartbeat(m.id(), b, true, true);
        clock.advance(11);
        battles.heartbeat(m.id(), b, true, true);
        battles.tick(m.id());
        var result = battles.snapshot(m.id(), b);
        assertEquals("FINISHED", result.status());
        assertEquals(
            "FORFEITED",
            result
                .players()
                .stream()
                .filter(p -> p.id().equals(a))
                .findFirst()
                .orElseThrow()
                .status()
        );
    }

    @Test
    void simultaneousLastSeatJoinOnlyAcceptsOnePlayer() throws Exception {
        var a = account();
        String room = room(a, false);
        UUID quiz = UUID.fromString(
            call(
                "POST",
                "/api/question-sets",
                a.token(),
                Map.of(
                    "title",
                    "Seats",
                    "questions",
                    List.of(Map.of("text", "?", "options", List.of("A", "B"), "correctIndex", 0))
                ),
                200
            )
                .path("id")
                .asText()
        );
        UUID id = battles.create(UUID.fromString(room), quiz, UUID.fromString(a.id())).id();
        var guests = new ArrayList<Account>();
        for (int i = 0; i < 4; i++) {
            var guest = account();
            guests.add(guest);
            call("POST", "/api/chat-rooms/" + room + "/join", guest.token(), null, 200);
            if (i < 2) {
                battles.join(id, UUID.fromString(guest.id()));
            }
        }
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var tasks = guests
                .subList(2, 4)
                .stream()
                .map(g ->
                    pool.submit(() -> {
                        gate.await();
                        try {
                            battles.join(id, UUID.fromString(g.id()));
                            return true;
                        } catch (org.springframework.web.server.ResponseStatusException e) {
                            return false;
                        }
                    })
                )
                .toList();
            gate.countDown();
            int joined = 0;
            for (var task : tasks) {
                if (task.get()) {
                    joined++;
                }
            }
            assertEquals(1, joined);
        }
        assertEquals(4, battles.players(id).size());
    }

    @Test
    void reactionsRequireMembershipAndToggleWithoutDuplicates() throws Exception {
        var a = account();
        var b = account();
        String room = room(a, true);
        long message = call(
            "POST",
            "/api/chat-rooms/" + room + "/messages",
            a.token(),
            Map.of("content", "Hello", "requestId", UUID.randomUUID()),
            200
        )
            .path("id")
            .asLong();
        String path = "/api/chat-rooms/" + room + "/messages/" + message + "/reactions";
        call("POST", path, b.token(), Map.of("emoji", "👍"), 403);
        call("POST", path, a.token(), Map.of("emoji", "arbitrary"), 400);
        call("POST", path, a.token(), Map.of("emoji", "👍"), 200);
        assertEquals(
            1,
            call("GET", "/api/chat-rooms/" + room + "/reactions", a.token(), null, 200).size()
        );
        call("POST", path, a.token(), Map.of("emoji", "👍"), 200);
        assertEquals(
            0,
            call("GET", "/api/chat-rooms/" + room + "/reactions", a.token(), null, 200).size()
        );
    }

    @Test
    void onlyRecipientMayAcceptFriendRequest() throws Exception {
        var a = account();
        var b = account();
        var c = account();
        call("POST", "/api/friend-requests", a.token(), Map.of("userId", b.id()), 200);
        call(
            "POST",
            "/api/friend-requests/respond",
            c.token(),
            Map.of("senderId", a.id(), "accept", true),
            404
        );
        call(
            "POST",
            "/api/friend-requests/respond",
            b.token(),
            Map.of("senderId", a.id(), "accept", true),
            200
        );
        assertTrue(
            call("GET", "/api/friends", a.token(), null, 200)
                .findValuesAsText("id")
                .contains(b.id())
        );
        assertTrue(
            call("GET", "/api/friends", b.token(), null, 200)
                .findValuesAsText("id")
                .contains(a.id())
        );
        call("POST", "/api/friend-requests", a.token(), Map.of("userId", a.id()), 400);
    }

    @Test
    void profileNamesAndAvatarsValidateAndPersist() throws Exception {
        var a = account();
        call("PUT", "/api/profile", a.token(), Map.of("displayName", "Tên mới"), 200);
        assertEquals(
            "Tên mới",
            call("GET", "/api/auth/me", a.token(), null, 200).path("displayName").asText()
        );
        call("PUT", "/api/profile", a.token(), Map.of("displayName", "  "), 400);
        var bad = new org.springframework.mock.web.MockMultipartFile(
            "file",
            "bad.png",
            "image/png",
            new byte[] { 0, 1, 2 }
        );
        mvc.perform(
            multipart("/api/profile/avatar")
                .file(bad)
                .header("Authorization", "Bearer " + a.token())
        ).andExpect(status().isBadRequest());
        var image = new java.awt.image.BufferedImage(
            10,
            10,
            java.awt.image.BufferedImage.TYPE_INT_RGB
        );
        var bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", bytes);
        var good = new org.springframework.mock.web.MockMultipartFile(
            "file",
            "avatar.png",
            "image/png",
            bytes.toByteArray()
        );
        mvc.perform(
            multipart("/api/profile/avatar")
                .file(good)
                .header("Authorization", "Bearer " + a.token())
        ).andExpect(status().isOk());
        mvc.perform(
            get("/api/profile/" + a.id() + "/avatar").header("Authorization", "Bearer " + a.token())
        )
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"));
        mvc.perform(get("/api/profile/" + a.id() + "/avatar")).andExpect(status().isUnauthorized());
    }

    @Test
    void documentContentAndDownloadPermissionsAreChecked() throws Exception {
        var a = account();
        var b = account();
        String room = room(a, true);
        var bad = new org.springframework.mock.web.MockMultipartFile(
            "file",
            "bad.txt",
            "text/plain",
            new byte[] { 0, (byte) 255 }
        );
        mvc.perform(
            multipart("/api/documents")
                .file(bad)
                .param("roomId", room)
                .header("Authorization", "Bearer " + a.token())
        ).andExpect(status().isBadRequest());
        var good = new org.springframework.mock.web.MockMultipartFile(
            "file",
            "notes.txt",
            "text/plain",
            "Ghi chú".getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
        var response = mvc
            .perform(
                multipart("/api/documents")
                    .file(good)
                    .param("roomId", room)
                    .header("Authorization", "Bearer " + a.token())
            )
            .andExpect(status().isOk())
            .andReturn();
        String id = json.readTree(response.getResponse().getContentAsString()).path("id").asText();
        call("GET", "/api/documents/" + id + "/download", b.token(), null, 403);
        mvc.perform(
            get("/api/documents/" + id + "/download").header("Authorization", "Bearer " + a.token())
        )
            .andExpect(status().isOk())
            .andExpect(content().bytes(good.getBytes()));
    }

    @Test
    void friendChatsArePrivateNamedForThePeerAndCannotBecomeGroups() throws Exception {
        var a = account();
        var b = account();
        var outsider = account();
        call("POST", "/api/chat-rooms/direct", a.token(), Map.of("userId", b.id()), 403);
        call("POST", "/api/friend-requests", a.token(), Map.of("userId", b.id()), 200);
        call(
            "POST",
            "/api/friend-requests/respond",
            b.token(),
            Map.of("senderId", a.id(), "accept", true),
            200
        );
        call("PUT", "/api/profile", b.token(), Map.of("displayName", "Bạn Bình"), 200);
        var direct = call(
            "POST",
            "/api/chat-rooms/direct",
            a.token(),
            Map.of("userId", b.id()),
            200
        );
        String id = direct.path("id").asText();
        assertEquals("DIRECT", direct.path("kind").asText());
        assertEquals("Bạn Bình", direct.path("name").asText());
        assertEquals(b.id(), direct.path("peerId").asText());
        assertTrue(direct.path("privateRoom").asBoolean());
        assertEquals(
            id,
            call("POST", "/api/chat-rooms/direct", b.token(), Map.of("userId", a.id()), 200)
                .path("id")
                .asText()
        );
        assertEquals(
            2,
            call("GET", "/api/chat-rooms/" + id + "/members", a.token(), null, 200).size()
        );
        call(
            "POST",
            "/api/chat-rooms/" + id + "/invite",
            a.token(),
            Map.of("userId", outsider.id()),
            403
        );
        call("POST", "/api/chat-rooms/" + id + "/leave", a.token(), null, 409);
        call("GET", "/api/chat-rooms/" + id + "/messages", outsider.token(), null, 403);
        assertFalse(
            call("GET", "/api/chat-rooms", outsider.token(), null, 200)
                .findValuesAsText("id")
                .contains(id)
        );
        call(
            "POST",
            "/api/chat-rooms/" + id + "/messages",
            a.token(),
            Map.of("content", "Chat bạn bè", "requestId", UUID.randomUUID()),
            200
        );
        assertEquals(
            "Chat bạn bè",
            call("GET", "/api/chat-rooms/" + id + "/messages", b.token(), null, 200)
                .get(0)
                .path("content")
                .asText()
        );
    }

    @Test
    void roomCallsRequireConsentMembershipAndLimitMeshSize() throws Exception {
        var a = account();
        var b = account();
        var c = account();
        var d = account();
        var e = account();
        var outsider = account();
        String room = room(a, true);
        for (var member : List.of(b, c, d, e)) {
            call(
                "POST",
                "/api/chat-rooms/" + room + "/invite",
                a.token(),
                Map.of("userId", member.id()),
                200
            );
        }
        String id = call("POST", "/api/chat-rooms/" + room + "/call", a.token(), Map.of(), 200)
            .path("id")
            .asText();
        assertEquals(
            id,
            call("POST", "/api/chat-rooms/" + room + "/call", a.token(), Map.of(), 200)
                .path("id")
                .asText()
        );
        call("GET", "/api/calls/" + id, outsider.token(), null, 403);
        call("POST", "/api/calls/" + id + "/join", outsider.token(), Map.of(), 403);
        call("GET", "/api/calls/" + id + "/ice-servers", b.token(), null, 403);
        call(
            "POST",
            "/api/calls/" + id + "/signal",
            a.token(),
            Map.of("targetId", b.id(), "kind", "offer", "payload", Map.of()),
            403
        );
        for (var member : List.of(b, c, d)) {
            call("POST", "/api/calls/" + id + "/join", member.token(), Map.of(), 200);
        }
        call("POST", "/api/calls/" + id + "/join", e.token(), Map.of(), 409);
        call("POST", "/api/calls/" + id + "/heartbeat", b.token(), Map.of("camera", false), 200);
        call(
            "POST",
            "/api/calls/" + id + "/signal",
            a.token(),
            Map.of("targetId", b.id(), "kind", "offer", "payload", Map.of("type", "offer")),
            200
        );
        call(
            "POST",
            "/api/calls/" + id + "/signal",
            a.token(),
            Map.of("targetId", b.id(), "kind", "invalid", "payload", Map.of()),
            400
        );
        String second = room(b, false);
        call("POST", "/api/chat-rooms/" + second + "/call", b.token(), Map.of(), 409);
        call("POST", "/api/calls/" + id + "/leave", a.token(), Map.of(), 200);
        assertEquals(
            "ACTIVE",
            call("GET", "/api/calls/" + id, b.token(), null, 200)
                .path("status")
                .asText()
        );
        call("POST", "/api/calls/" + id + "/join", e.token(), Map.of(), 200);
        call(
            "POST",
            "/api/calls/" + id + "/signal",
            a.token(),
            Map.of("targetId", b.id(), "kind", "ice", "payload", Map.of()),
            403
        );
        clock.advance(31);
        assertEquals(
            "ENDED",
            call("GET", "/api/calls/" + id, b.token(), null, 200)
                .path("status")
                .asText()
        );
    }

    @Test
    void friendCallCanBeDeclinedAndEndsWhenEitherPersonLeaves() throws Exception {
        var a = account();
        var b = account();
        call("POST", "/api/friend-requests", a.token(), Map.of("userId", b.id()), 200);
        call(
            "POST",
            "/api/friend-requests/respond",
            b.token(),
            Map.of("senderId", a.id(), "accept", true),
            200
        );
        String room = call(
            "POST",
            "/api/chat-rooms/direct",
            a.token(),
            Map.of("userId", b.id()),
            200
        )
            .path("id")
            .asText();
        String id = call("POST", "/api/chat-rooms/" + room + "/call", a.token(), Map.of(), 200)
            .path("id")
            .asText();
        call("POST", "/api/calls/" + id + "/decline", b.token(), Map.of(), 200);
        assertEquals(
            "ENDED",
            call("GET", "/api/calls/" + id, a.token(), null, 200)
                .path("status")
                .asText()
        );
        String next = call("POST", "/api/chat-rooms/" + room + "/call", a.token(), Map.of(), 200)
            .path("id")
            .asText();
        assertNotEquals(id, next);
        call("POST", "/api/calls/" + next + "/join", b.token(), Map.of(), 200);
        call("POST", "/api/calls/" + next + "/leave", b.token(), Map.of(), 200);
        assertEquals(
            "ENDED",
            call("GET", "/api/calls/" + next, a.token(), null, 200)
                .path("status")
                .asText()
        );
        String unanswered = call(
            "POST",
            "/api/chat-rooms/" + room + "/call",
            a.token(),
            Map.of(),
            200
        )
            .path("id")
            .asText();
        clock.advance(29);
        call(
            "POST",
            "/api/calls/" + unanswered + "/heartbeat",
            a.token(),
            Map.of("camera", true),
            200
        );
        clock.advance(17);
        assertEquals(
            "ENDED",
            call("GET", "/api/calls/" + unanswered, a.token(), null, 200)
                .path("status")
                .asText()
        );
    }

    @Test
    void simultaneousDirectChatOpensReuseOneRoom() throws Exception {
        var a = account();
        var b = account();
        call("POST", "/api/friend-requests", a.token(), Map.of("userId", b.id()), 200);
        call(
            "POST",
            "/api/friend-requests/respond",
            b.token(),
            Map.of("senderId", a.id(), "accept", true),
            200
        );
        UUID first = UUID.fromString(a.id());
        UUID second = UUID.fromString(b.id());
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var left = pool.submit(() -> {
                gate.await();
                return chatService.direct(first, second).id();
            });
            var right = pool.submit(() -> {
                gate.await();
                return chatService.direct(second, first).id();
            });
            gate.countDown();
            assertEquals(left.get(), right.get());
        }
        assertEquals(
            1,
            chatService
                .rooms(first)
                .stream()
                .filter(r -> r.kind().equals("DIRECT"))
                .count()
        );
    }
}
