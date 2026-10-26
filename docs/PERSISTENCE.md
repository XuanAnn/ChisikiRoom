# Database persistence — backend 0.9.0

The backend uses Spring Data JPA / Hibernate for all application database access. `JdbcClient`, JDBC row mappers, native SQL queries and handwritten SQL writes have been removed from production Java code. Flyway SQL migrations remain the authority for schema changes.

## Layout

- Each feature owns `infrastructure/persistence/entity/` (28 JPA entities), `infrastructure/persistence/key/` (10 explicit composite ID classes) and `infrastructure/persistence/repository/` (13 repositories).
- Composite keys are top-level named classes such as `RoomMemberId`, `BattleAnswerId` and `FriendshipId`, with the same fields, constructors, equality and hash semantics previously defined in nested `Entity.Key` classes. `@IdClass` references these ID classes.
- Moving Java packages preserves entity simple names, JPQL, tables, column mappings, generated IDs and scalar cross-module references.
- `UserRepository`, `SessionRepository`, `QuestionSetRepository` and `DocumentRepository` use Spring Data `JpaRepository`, derived finder methods and entity persistence. Session lookup has an explicit JPQL query in its repository.
- `ChatRepository`, `BattleRepository`, `CallRepository`, `FriendsRepository`, `ReactionRepository` and `ProfileRepository` expose typed feature persistence operations. Chat member row projection is converted to a named repository record before reaching the service.
- `common/infrastructure/JpaStore` provides EntityManager queries, entity insertion/removal, flushing and aggregate locking behind these infrastructure adapters. Application services do not access this generic helper directly. Queries use JPQL entity/attribute names rather than SQL table/column names. Existing entity changes are saved by Hibernate dirty checking at transaction commit.
- Cross-module references remain UUID values instead of navigable entity graphs. API responses are explicit DTO records; entities, password hashes and session hashes are never serialized as responses.
- Application transactions cover DTO construction. `spring.jpa.open-in-view=false` prevents hidden database access during response rendering.

The entity/package refactor keeps the current REST API and database schema V17 unchanged. Existing desktop 0.9.0 remains compatible; no desktop rebuild or new Flyway migration is required. All existing SQL migrations remain untouched. `ddl-auto=validate` checks mapping compatibility without creating/updating/dropping user tables. Hibernate is configured with UTC JDBC time handling.

## Concurrency and transaction rules

- Battle mutation obtains `PESSIMISTIC_WRITE` on its Battle entity before checking seats, rounds, answers, deadlines or scores. Dirty entity updates, score ledger entries and outbox entries commit together.
- Calling locks account rows before joining, and the chat room aggregate before changing a call. The call entity is read/refreshed after that lock. The last seat remains serialized, and a user cannot concurrently join two calls.
- Direct chat/friendship operations lock both users in database UUID order. All paths use the same order.
- Profile name/avatar writes lock the user row, preventing one concurrent update from overwriting the other's fields.
- `JpaStore.lock` refreshes an entity first loaded before acquiring its pessimistic lock, so Hibernate's first-level cache cannot return pre-lock state after waiting for another commit. Repeated locks in one transaction do not refresh away pending managed changes.
- Deleting an ended call and inserting its replacement includes an explicit flush between them to respect the unique room constraint. Database FK cascades remain in effect.
- Business exceptions roll back entity updates and inserts. Files are removed on failed metadata transactions. Realtime notifications remain after-commit; Battle's durable outbox still uses locked, transactional publication.

## Extending persistence

1. Add a Flyway migration for a schema change; do not enable Hibernate `update` or `create` in the application configuration.
2. Add/update the owning module's entity mapping. Prefer a feature repository for reusable queries, and DTO projections for large lists.
3. Keep writes inside application `@Transactional` use cases. Load a managed entity and change its fields; do not mix JDBC updates with cached entities.
4. Lock the aggregate before checking concurrent business invariants. Retain database unique constraints as the final guard.
5. Run the backend tests and PostgreSQL concurrency checks. H2 tests alone do not establish PostgreSQL locking behavior.

Profile/file/friend/reaction controllers now delegate to `ProfileService`, `DocumentService`, `FriendsService` and `ReactionService`. `ProfileRepository`, `DocumentRepository`, `FriendsRepository` and `ReactionRepository` encapsulate their persistence operations. Response DTOs belong to the application layer; services do not accept `Authentication` or `MultipartFile`.

`UploadStorage` handles physical files. Upload services keep transaction commit inside the cleanup `try/catch`, so a commit failure rolls back metadata and removes the newly written file. Dedicated tests exercise failures just before commit for both avatar and document uploads. Initial multipart size validation happens before loading the byte array; services validate the actual bytes again before writing.

Core chat/Battle/calling now use typed feature repositories. Auth session persistence also has its own Spring Data repository; the unused generic persistence dependency was removed from quiz. Application services retain business decisions, lock ordering and transaction boundaries. Boundary checks prevent direct `JpaStore`/EntityManager access and HTTP upload/authentication types in application services, as well as persistence or file IO in controllers. Further domain model/port extraction is possible without changing API contracts.


## Infrastructure là gì?

Đây là tầng chứa cơ chế kỹ thuật: JPA/database, lưu file, kết nối realtime và worker. Nó triển khai cách đọc/ghi hoặc giao tiếp, không quyết định luật như ai được cấp quyền quản trị hay cách tính điểm.

```text
chat/infrastructure/persistence/
  entity/       MessageEntity, ChatRoomEntity, RoomMemberEntity
  key/          RoomMemberId, ReactionId, GroupInvitationId, GroupBanId
  repository/   ChatRepository, DocumentRepository, ReactionRepository
```

Application service gọi repository của feature. Controller nhận/trả DTO và gọi service. Domain model thuần nghiệp vụ có thể được tách thêm khi cần; đợt này không nhân đôi JPA entity thành một mô hình domain mới.
