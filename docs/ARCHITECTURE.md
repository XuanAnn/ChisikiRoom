# ChisikiRoom — architecture

## Deployment and boundaries

ChisikiRoom is a modular monolith: one Spring Boot process and PostgreSQL database, with feature packages rather than separate deployable business services. The Electron desktop application uses REST for commands/snapshots and authenticated STOMP user queues for realtime notifications and WebRTC signaling. Audio/video travels directly between participants, not through the message broker.

```text
frontend/
  src/                    Browser adapter and web workspace; imports desktop/src shared UI
  dist/                   Generated static web build, ignored by Git
desktop/src/
  app/                    Entry point, layouts, shared app styles
  features/
    auth/                 Profile and server settings
    community/            Friends
    chat/                 Conversations, files, reactions, split sidebar
    quiz/                 Quiz editor
    battle/               Battle windows and lobby
    calling/              Friend and group calls independent of Battle
  components/             Avatar, video renderer
  hooks/                  Shared P2P media engine
  lib/                    Typed IPC API client
backend/src/main/java/com/chisikiroom/
  identity/               Authentication, profiles, HTTP security
  community/              Friendship and presence
  chat/                   Membership, messages, documents, reactions
  quiz/                   Personal and shared question sets
  battle/                 Scoring, rounds, deadlines, recovery, durable outbox
  calling/                Consent, participants, call lifecycle
  realtime/               STOMP transport, after-commit notifications, ICE configuration
  common/                 Error mapping, authenticated user helper
  ranking/                Global N5/N4 rating, matchmaking, seasons and settlement
```

The web and Electron clients share `desktop/src/app/App.tsx`, feature components and hooks. `desktop/src/app/main.tsx` remains the Electron renderer entry; `frontend/src/main.tsx` installs a browser bridge before importing shared components. The common API action mapping lives in `desktop/electron/api-routes.mjs`, imported by Electron main and the web adapter. Browser requests use native fetch and STOMP over native WebSocket; Electron uses IPC to its main process. Web tools are in-page views and incoming calls use a modal, while Electron retains native windows. Browser tokens are memory-only and independent per tab. Production web hosting should proxy REST and WebSocket on the web origin; no permissive backend CORS policy was added.

Inside a feature, `presentation` contains HTTP adapters, `application` orchestrates use cases and transactions, `domain` holds transport-independent policy, and `infrastructure` contains background workers and framework configuration. Authentication and quiz use cases are separate from controllers; Battle calls the quiz application service rather than its REST adapter. Shared media has no Battle scoring/readiness dependency.

Backend 0.3.2 makes profile/avatar, friend, reaction and document controllers HTTP adapters: authentication/validation, input conversion and response headers. Their application services own business rules and transactions; feature repositories own JPA access. `UploadStorage` owns file IO, `DocumentContentPolicy` validates document content, and `UserPresence` hides broker presence lookup. The boundary test forbids controllers from importing infrastructure/JPA or owning filesystem/database transactions.

Backend 0.3.3 moves chat, Battle and calling queries into `ChatRepository`, `BattleRepository` and `CallRepository`; auth session lookup/storage uses `SessionRepository`. Application services use typed feature operations and no longer import `JpaStore` or EntityManager. Services still update managed entity state inside their transaction; this is a practical layered monolith, not a claim of complete domain/persistence independence. Infrastructure workers retain low-level outbox polling. Production Java code uses JPA rather than JDBC queries; Redis is not required for LAN. See [persistence](PERSISTENCE.md) for transaction and lock rules.

## Realtime delivery

- Authenticate STOMP CONNECT, SUBSCRIBE and outgoing delivery. Each client subscribes only to its own `/user/queue/events`.
- Persist chat/business state in PostgreSQL; REST snapshots remain authoritative.
- Emit ordinary notifications after transaction commit. Reconnect and periodic polling recover missed notifications.
- Battle transitions use the existing transactional outbox, sequence numbers and idempotent scoring ledger.
- Call notifications (`CALL_INVITED`, `CALL_CHANGED`, `CALL_ENDED`) are ephemeral after-commit events, recovered by call snapshots. `CALL_SIGNAL` SDP/ICE is ephemeral and scoped to active participants. A durable broker is unnecessary for SDP/ICE.

## Calls outside Battle

- Any current chat member can start or explicitly join a call. A direct chat already requires accepted friendship. Private group membership rules apply unchanged.
- Creating a call joins its caller. Invitees see a notification and choose accept or decline. Neither action automatically acquires camera/microphone.
- Camera and microphone are independently optional. Closing the call window releases media and requests leave. No recording is implemented.
- At most four participants per call, with the last seat serialized by a room row lock. A user can join at most one call; account row locking serializes concurrent joins. The desktop prevents simultaneous call and Battle media windows.
- A direct call ends when either participant leaves or an invitee declines. Group calls continue while a participant remains. An unanswered call expires after 45 seconds. A disconnected participant expires after 30 seconds without heartbeat.
- Membership is rechecked server-side for snapshots, heartbeat, ICE configuration and signaling. Room departure revokes media signaling access. Cleanup removes former members and expires abandoned calls.
- Joining, camera changes and leaving generate sequence-numbered notifications. Clients poll and apply the newest snapshot.

## Media phases

**LAN now:** a shared WebRTC mesh engine creates one peer connection per pair, deterministic UUID offer ownership, serialized SDP/ICE processing, video/audio transceivers, microphone switching and ICE restart. A group of four creates six pairwise connections. Each sender uploads a stream to each peer. The cap is a conservative product default, not a bandwidth guarantee.

**Internet later:** deploy an authenticated TLS backend and configured STUN/TURN service; keep TURN credentials server-generated and short-lived. Real physical devices, different routers and Internet fallback still need acceptance testing.

**Larger groups later:** introduce a media transport interface implemented by the P2P engine and an SFU adapter. Preserve calling membership/consent APIs; add server-issued SFU room credentials after authorization. Choose and validate an SFU with real usage measurements. This release does not include or claim SFU support.

`ai-service/` is reserved for a later FastAPI integration. It is not launched by Compose. Root `compose.yaml` remains the entry point to preserve existing volume naming and LAN startup commands; deployment assets belong in `infrastructure/`.

Ranking 0.7.0 dùng phòng Battle riêng room_id NULL, có ranked_level rõ ràng, chỉ hai người đã ghép được join; worker riêng điều phối tự bắt đầu và chốt rating. Battle không phụ thuộc ngược ranking. Xem [Ranking](RANKING.md).

Persistence được tách thành `infrastructure/persistence/entity`, `key`, `repository` trong từng feature. Tên entity dùng trong JPQL và mapping bảng/cột giữ nguyên; DTO/API không phụ thuộc vị trí package của JPA entity. Xem [Persistence](PERSISTENCE.md).
