# Coding style

- Write explicit, readable code with complete line breaks.
- Use descriptive names for variables, functions and intermediate conditions.
- Declare each variable or React state hook separately.
- Put each statement on its own line. Use braces for conditional and loop bodies.
- Prefer named intermediate values and straightforward branches over nested ternaries.
- Keep business logic separate from rendering where practical.
- Run `npm run format` after source edits and `npm run format:check` before finishing.
- Preserve existing behavior during readability refactors; validate with the relevant build/tests.
- Do not reformat existing Flyway SQL migrations because their checksums are already applied.

# Backend layers

- Keep controllers limited to authentication context, HTTP input validation/conversion and response construction.
- Put business rules and transaction boundaries in application services. Pass IDs and application DTOs rather than `Authentication` or `MultipartFile` into services.
- Put JPA queries and entity access in feature repositories; do not import persistence or file storage into controllers.
- Use typed feature repositories in application services; keep `JpaStore`/EntityManager access inside infrastructure.
- Keep physical upload operations in `UploadStorage` and content validation in the relevant application policy.
- For uploads, include metadata transaction commit inside the cleanup `try/catch` so a failed commit removes the new file.
- Preserve database lock ordering, after-commit events and existing API contracts when extracting repositories.

# Git delivery

- Repository: https://github.com/XuanAnn/ChisikiRoom.git.
- The user authorizes automatic commits and pushes after completed changes pass the relevant checks.
- Review the diff and staged files before committing. Keep secrets, local runtime data, database backups and build artifacts out of Git.
- Push to the current working branch and report the commit and push result. Never force-push or rewrite remote history without explicit authorization.
- Keep commit messages short and clear, stating the main change without unnecessary detail.
