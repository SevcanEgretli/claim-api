---
description: Add a new Playwright API test (or a new resource client) to this repo, following its established architecture, data, and bug-documentation conventions. Use whenever the user asks to add/write a test for an endpoint, cover a new resource, or investigate/document API behavior.
---

# Writing a test in this project

This is a Playwright + TypeScript black-box API test suite. Five project-wide rules are **non-negotiable** and apply to every test you add, no exceptions:

1. **API clients are mandatory.** Never call `request.get/post/patch/delete` directly in a test. Always go through a typed client under `api/clients/`.
2. **No hardcoded test data.** Build request payloads with `@faker-js/faker` via a factory in `utils/testData/`, not literal strings/numbers in the spec file.
3. **No hardcoded waits.** No bare `sleep`/fixed timeouts. If something settles asynchronously, use `utils/pollUntil.ts` or Playwright's built-in polling assertions.
4. The suite must stay **easily extensible**, **easy to maintain**, and **readable**.
5. **Verify real API behavior before writing assertions — never assume.** Documentation (Swagger) can be wrong or incomplete. Probe the live endpoint (curl, or a scratch script) first, then write the test to match what you actually observed.

## Step-by-step

### 1. Identify what already exists

- Resource client: check `api/clients/` for a `*Client.ts` extending `BaseApiClient` (e.g. `ClaimsClient.ts`). If the endpoint belongs to an existing resource, add a method there. If it's a brand-new resource, create a new client class following the exact same pattern (one class per resource, methods named after the operation: `createX`, `getX`, `listX`, `updateX`, `deleteX`).
- Types: check `api/types/*.types.ts` for existing request/response shapes derived from the OpenAPI/Swagger spec. **Response shapes are zod schemas** (`ClaimSchema`, `ListClaimsResponseSchema`, `RpcStatusSchema`, ...) with the TS type inferred via `z.infer<>` — add new ones the same way, not as plain `interface`s, so a happy-path test can `Schema.parse(await response.json())` for a real runtime check instead of a compile-time-only cast. Request shapes (things we author ourselves, e.g. `CreateClaimRequest`) stay plain TS interfaces — no drift risk to guard against there. Don't inline types in the spec file either way.
- Test data factory: check `utils/testData/` for an existing faker-based builder for this resource's payload (e.g. `validCreateClaimPayload()`). Reuse or extend it with an `overrides` parameter rather than writing a new one from scratch.
- Fixture: check `fixtures.ts` for a `*Client` fixture. If the resource supports creation + deletion, its client should be wrapped in a `Tracking*Client` subclass (see the existing `TrackingClaimsClient`) that records every id it creates and deletes them all in fixture teardown — this is how the suite avoids leaving junk data in the shared test environment. Follow this pattern for any new resource that creates data.

### 2. Confirm the real behavior first

Before writing a single assertion, hit the live API directly (e.g. `curl` with the `Authorization: Bearer <API_KEY>` header from `.env`) for the happy path and the edge cases you plan to cover: empty/missing required fields, wrong types, not-found ids, unauthorized requests, boundary values, etc. Note the actual status code, error shape, and field values returned — do not assume they match the documented schema.

### 3. Decide where the test belongs

- **`tests/integration/<resource>/`** — one endpoint's behavior in isolation (e.g. `tests/integration/claims/create-claim.spec.ts`). This is the bulk of the suite. POST/GET/PATCH/DELETE/LIST each typically get their own file. Within a file, a happy-path/normal describe block is often paired with a separate `- design observations` or `- known bugs` describe block (see step 5).
- **`tests/integration/contract/`** — cross-cutting checks that span more than one endpoint or aren't about a single operation's happy/error path (e.g. unexpected/undocumented fields, idempotency, concurrent-access correctness, multi-status coverage that requires create+patch+list together). See `unexpected-fields.spec.ts`, `idempotency.spec.ts`, `concurrency.spec.ts`, and `status-filter-coverage.spec.ts` for examples.
- **`tests/integration/errors/`** — HTTP-framing errors that apply regardless of which endpoint you hit: malformed JSON body, wrong/missing `Content-Type`. See `common.spec.ts`.
- **`tests/integration/auth.spec.ts`** — auth failures (missing/invalid/wrong-scheme credentials), flat file at the `tests/integration/` root since it applies across every endpoint.
- **`tests/e2e/`** — a full, realistic multi-step business flow in one test. Keep this folder small; only a handful of high-value flows belong here, one file per flow (mirrors the reference payment project's per-flow e2e files). See `claim-lifecycle.spec.ts` (create → appears in list → retrievable → deleted → gone) and `failed-claim-submission.spec.ts` (a rejected creation leaves no trace anywhere in the system — proved by a unique fingerprint field, e.g. `claimantId`, not by id, since a failed create never returns one).

### 4. Write the test

- Import via path aliases only: `@fixtures`, `@api/*`, `@utils/*`, `@config/*` — never relative paths like `../../../api/clients/ClaimsClient`.
- Get your client from the fixture (e.g. `async ({ claimsClient }) => { ... }`), never from the raw `request` fixture.
- Build payloads via the faker-based factory; pass `overrides` for anything the specific test case needs to differ.
- For a set of related negative/validation cases, use the `ValidationCase<T>` (or similarly shaped) table-driven pattern instead of copy-pasting near-identical tests — see `create-claim.spec.ts`.
- Assert on the actual response (status code + parsed body), matching what you confirmed in step 2, not what the docs claim.
- Parsing a response for a happy-path or design-observation test? Use `Schema.parse(await response.json())` (e.g. `ClaimSchema.parse(...)`), not a plain `const x: Claim = await response.json()` cast — see "Runtime schema validation" in README. Exception: `- known bugs` tests keep the plain cast, since they're reading a resource already known to be in a wrong _state_ (e.g. a wiped field), not validating its _shape_; a schema check there would just be noise around the actual bug being demonstrated.
- Testing an auth failure? Use the `unauthenticatedClaimsClient` fixture (no `Authorization` header), or build a one-off `playwright.request.newContext(...)` + `new ClaimsClient(context)` inline for other malformed-auth cases (wrong scheme, invalid token) — see `auth.spec.ts`.
- Need to send something a typed method can't express (raw malformed JSON, a header override like `Content-Type`)? Use `ClaimsClient.createClaimRaw(body, headers?)` rather than reaching for the raw `request` fixture — see `errors/common.spec.ts`. If a similar escape hatch doesn't exist yet for the method you need, add one the same way rather than bypassing the client.
- If your test creates data through a new method on the client (not just `createClaim`), make sure `TrackingClaimsClient` in `fixtures.ts` overrides that method too (via its shared `trackIfCreated` helper) so cleanup still happens automatically.

### 5. If you find a bug, classify it correctly

- **Real, unambiguous defect** (response contradicts the documented schema or violates a basic contract, e.g. data loss, wrong status code, broken pagination): write it as a `test.fail()` regression test. Put a comment above it explaining exactly what's wrong. Add a numbered entry to README.md's "Bugs Found" section. The suite stays green while the bug is open; the test flips to "unexpectedly passed" (failing the run) the moment it's fixed — that's the signal to promote/remove the `test.fail()`.
- **Ambiguous/leniency behavior** (not wrong per the docs, but worth flagging to the API owners — e.g. accepting undocumented extra fields): write it as a normal **passing** test (no `test.fail()`) with a comment explaining it's a requirements question, not a bug. Add an entry to README.md's "Design Observations" section instead.
- If a bug blocks testing something else entirely (e.g. one endpoint's bug makes a piece of another endpoint's behavior unreachable), still write the blocked test as `test.fail()` rather than skipping it silently — it documents the gap and will self-activate once the root cause is fixed.

**Avoid exact-count assertions across two round trips.** `playwright.config.ts` runs everything with `workers: 1` specifically to stop this suite's own tests from racing each other against the one shared, live, mutable API — but the environment can still be mutated by _external_ actors (another person, another session) between your two calls. Don't fetch a total, then fetch again and assert the second count equals the first; that's still racy. Instead prove things by inclusion — create your own claim and assert `.some((c) => c.id === created.id)` (or similar) — the way most tests in this suite already do. If you genuinely need a snapshot-style count comparison (e.g. the pagination bug tests), accept that it's a known, narrow residual flake surface even with a single worker.

### 6. After writing

- `npm run typecheck` — must pass clean.
- `npm run lint` — must pass clean (ESLint + `eslint-plugin-playwright`, e.g. it'll catch `toBe` used where `toHaveLength`/`toHaveCount` reads better, or a missing `await` on an assertion). Use `npm run lint:fix` for autofixable issues.
- `npm run format` — apply Prettier formatting before considering the test done; CI runs `npm run format:check` and will fail on unformatted files.
- `npx playwright test <your new file>` — run against the real API (this project always tests against a live environment, not mocks) and confirm the results match your expectations (including which tests are _expected_ to fail via `test.fail()`).
- Update README.md if you added a new bug, design observation, or changed the project structure.
- Keep test-created data cleaned up — rely on the `Tracking*Client` auto-cleanup fixture rather than manual deletes, unless the test is specifically about deletion.
