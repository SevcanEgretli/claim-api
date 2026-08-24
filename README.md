# Claim Service API Tests

Automated test suite written with Playwright + TypeScript for the Claim Service API. Black-box API tests only.

All 5 `/v1/claims` endpoints (create/get/list/update/delete) have dedicated integration coverage, plus auth, malformed-request, idempotency, and concurrent-access checks, plus two e2e flows (one successful, one rejected) — 44 tests total. 9 real bugs and 6 design observations found so far — see "Bugs Found" and "Design Observations" below.

Every assertion is grounded in the live API's actual behavior, confirmed by direct probing before being written rather than assumed from the Swagger spec — see "Adding New Tests" below for how to extend the suite the same way.

- **API structure, endpoints, and assumptions:** [docs/API_UNDERSTANDING.md](docs/API_UNDERSTANDING.md)
- **Full enumerated test case list:** [docs/TEST_CASES.md](docs/TEST_CASES.md)

## Project Structure

```
claim-service-api/
├── .github/workflows/api-tests.yml   # CI workflow (push/manual/daily)
├── docs/
│   ├── API_UNDERSTANDING.md          # API structure, endpoints, assumptions
│   └── TEST_CASES.md                 # enumerated list of all 44 test cases
├── config/
│   └── env.ts                        # reads base URL + API key from .env
├── api/
│   ├── clients/
│   │   ├── BaseApiClient.ts          # wraps Playwright's request context: get/post/patch/delete
│   │   └── ClaimsClient.ts           # typed methods for every /v1/claims endpoint
│   └── types/
│       ├── claim.types.ts            # Claim/ListClaimsResponse zod schemas (+ inferred types), request types
│       └── common.types.ts           # RpcStatus/UnauthorizedErrorBody zod schemas, ValidationCase<T>
├── fixtures.ts                       # claimsClient (auto-cleanup) + unauthenticatedClaimsClient fixtures
├── utils/
│   ├── pollUntil.ts                  # generic polling helper for endpoints that settle asynchronously
│   └── testData/
│       └── claims.ts                 # faker-based payload builders
├── tests/
│   ├── e2e/                          # a few tests, each covering one full business flow end-to-end
│   └── integration/                  # many tests, each covering one endpoint/behaviour in isolation
│       ├── auth.spec.ts                  # 401 scenarios, cross-cutting (uses unauthenticatedClaimsClient)
│       ├── claims/                       # per-endpoint tests (create-claim.spec.ts, ...)
│       ├── contract/                     # cross-cutting checks: undocumented/edge behaviour, not tied to one endpoint
│       └── errors/                       # cross-cutting HTTP-framing errors: malformed JSON, Content-Type
├── eslint.config.mjs                 # ESLint (typescript-eslint + eslint-plugin-playwright)
├── .prettierrc.json                  # Prettier formatting rules
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

**API clients are mandatory.** Tests never call `request.get/post/...` directly — always through a typed client under `api/clients/`, one class per resource. This is a hard project rule, not just a convention: it keeps every request typed, keeps endpoint knowledge in one place, and makes adding a new resource a matter of adding one more client + spec folder rather than inventing a new pattern.

**Two layers, on purpose.** `tests/integration/` holds the bulk of the suite: many small, isolated tests, each pinned to one endpoint's behaviour. `tests/e2e/` stays small: a handful of tests that each walk through one full, realistic flow in a single test.

**Path aliases.** Import shared code via `@fixtures`, `@api/*`, `@utils/*` and `@config/*` (configured in `tsconfig.json`'s `paths`, natively resolved by Playwright) instead of relative paths like `../../../api/clients/ClaimsClient`.

## Setup

```bash
npm install
cp .env.example .env   # fill in your API_KEY
npx playwright test
npm run test:report    # open the latest HTML report
```

`.env.example` is the committed template listing the required variables (`API_BASE_URL`, `API_KEY`); `.env` is your local copy with real values and is git-ignored (see `.gitignore`), so it never gets committed or shared. The API key is never hardcoded; `config/env.ts` reads both variables from `.env` and throws a clear error naming the missing one — and pointing back at `.env.example` — if either is absent. The Playwright config attaches the key as a Bearer token on every request automatically.

**Code quality.** `npm run typecheck` (TypeScript), `npm run lint` (ESLint, with `eslint-plugin-playwright` for test-specific rules — `npm run lint:fix` for autofixable issues) and `npm run format:check` (Prettier — `npm run format` to apply) all run in CI on every push and must pass clean.

**CI setup.** `.github/workflows/api-tests.yml` runs on every push to `main`, every pull request into `main`, daily on a schedule, and on manual dispatch. It needs two things configured in the repo (Settings → Secrets and variables → Actions): a repository **variable** named `API_BASE_URL` (the same value as your local `.env`) and a repository **secret** named `CLAIM_API_KEY` (the API key — kept as a secret rather than a variable since it's sensitive, unlike the base URL). Without these the workflow will fail at the "Run API tests" step with the same missing-env-var error `config/env.ts` throws locally.

## Test Strategy

**No hardcoded data.** Request payloads come from factory functions in `utils/testData/` built on `@faker-js/faker` (e.g. `validCreateClaimPayload()`), not literal strings baked into spec files. `Partial<Record<keyof T, unknown>>`-typed `overrides` let a test build a deliberately invalid payload (wrong type, empty value, etc.) through the same factory.

**No hardcoded waits.** If an endpoint settles asynchronously, wait for it with `utils/pollUntil.ts` (or Playwright's built-in polling assertions), not a fixed `sleep`. `POST /v1/claims` turned out to be synchronous (no "processing" state), so no test currently needs this — kept ready for the next endpoint that does.

**Runtime schema validation, not just compile-time casts.** `api/types/claim.types.ts` and `common.types.ts` define [zod](https://zod.dev) schemas (`ClaimSchema`, `ListClaimsResponseSchema`, `RpcStatusSchema`, `UnauthorizedErrorBodySchema`) alongside the TS types inferred from them. Happy-path and design-observation tests call `Schema.parse(await response.json())` instead of `const x: Claim = await response.json()` — the latter is a compile-time-only cast that trusts the response blindly; if the real API's shape ever drifted (a field renamed, a type changed), every test using a plain cast would keep "passing" unless it happened to assert on that exact field. `.parse()` makes contract drift a real, immediate test failure instead of silent staleness. (`test.fail()` bug-regression tests intentionally keep the plain cast — they're reading a resource already known to be in a wrong _state_, not validating its _shape_.)

**Auto-cleanup.** `fixtures.ts`'s `claimsClient` fixture is backed by a `TrackingClaimsClient` that records every claim id it creates (through any create-like method, including the raw escape hatch below) and deletes them all in teardown, so the shared test environment doesn't accumulate leftover data and tests don't need manual cleanup code.

**Single worker, on purpose.** `playwright.config.ts` sets `workers: 1` and `fullyParallel: false` everywhere, not just in CI. Every test hits one real, shared, mutable API — no mocks — so two tests running concurrently can race (e.g. one test fetches a total, then fetches again expecting the same total, while another test creates a claim in between). Running strictly sequentially costs a little local speed (41 tests take ~3.5s instead of ~2s) in exchange for eliminating that whole class of flake. Tests still can't fully control _external_ actors on the shared environment (another person, another session), which is why most assertions prove things by inclusion (`.some((c) => c.id === created.id)`) rather than by exact counts wherever that's possible — see `tests/integration/claims/list-claims.spec.ts`'s "design observations" for the pattern.

**Table-driven negative tests.** Use `ValidationCase<T>` from `@api/types/common.types` for "invalid input → expected error" cases (see `tests/integration/claims/create-claim.spec.ts`).

**Testing auth failures.** `fixtures.ts` also exposes `unauthenticatedClaimsClient`, a `ClaimsClient` backed by a fresh request context with no `Authorization` header, for testing what happens when auth is missing. For other malformed-auth cases (wrong scheme, invalid token), build a one-off context inline with `playwright.request.newContext(...)` (see `tests/integration/auth.spec.ts`).

**Testing malformed requests.** `ClaimsClient.createClaimRaw(body, headers?)` is a typed escape hatch for negative tests that need to bypass the normal request-shape typing entirely — a raw malformed-JSON string, or a header override like a non-JSON `Content-Type` (see `tests/integration/errors/common.spec.ts`). Prefer the normal typed methods for everything else; this exists specifically for cases where "wrong shape" is the point of the test.

## Bugs Found

While building the suite I found **9 real, reproducible bugs**: 4 in `PATCH /v1/claims/{id}` (`tests/integration/claims/update-claim.spec.ts`), 4 in `GET /v1/claims` (`tests/integration/claims/list-claims.spec.ts`), and 1 in `GET /v1/claims/{id}` (`tests/integration/claims/get-claim.spec.ts`). All are documented as `test.fail()` tests, with titles consistently prefixed `BUG: ` — the suite stays green while the bugs are open, but a test will flip to "unexpectedly passed" (failing the run) the moment any is fixed, turning them into living regression tests rather than one-off bug reports. `npm run test:bugs` runs only these 13 (`--grep "BUG:"`); `npm run test:passing` runs everything else (31 tests, `--grep-invert "BUG:"`) for a report with no expected failures in it.

**`PATCH /v1/claims/{id}`:**

1. **Status changes are silently ignored.** Sending `{"status": "CLAIM_STATUS_PENDING"}` returns `200`, but the claim's `status` never actually changes — a follow-up `GET` shows it's stuck at whatever it was before. In practice this makes `CLAIM_STATUS_PENDING`/`CLAIM_STATUS_UNDER_REVIEW`/`CLAIM_STATUS_REJECTED` unreachable through the API today, since `POST /v1/claims` always creates a claim as `CLAIM_STATUS_APPROVED` and `PATCH` can't move it anywhere else.
2. **Omitted fields are wiped, not preserved.** `PATCH` is documented as a partial update (`ClaimServiceUpdateClaimBody`, every field optional), but sending only `{"status": ...}` clears `title` and `description` to empty strings instead of leaving them untouched. The `PATCH` response itself doesn't reveal this — it echoes the pre-update values — so the wipe is only visible on a subsequent `GET`, which is why the tests read ground truth from `getClaim`, not the `updateClaim` response.
3. **No required-field validation.** `POST /v1/claims` rejects an empty `title`/`description` with `400`/`code: 3` (see "Test Strategy" above), but `PATCH` applies no such rule: sending `{"title": "", "description": ""}` — or omitting them entirely, per bug 2 — returns `200` and silently clears the required fields instead of rejecting the request.
4. **`updatedAt` never changes.** After a `PATCH` that does have an observable effect (e.g. the field wipe in bug 2), `updatedAt` on the resulting claim is still byte-identical to `createdAt`. A resource's `updatedAt` should move forward on every successful mutation; it doesn't move at all.

**`GET /v1/claims`:**

5. **`pageSize` returns one fewer item than requested (off-by-one).** `pageSize=2` returns 1 claim, `pageSize=3` returns 2, `pageSize=11` (equal to the actual total at the time) returns 10 — consistently `pageSize - 1`. This only holds while `pageSize` is at or below the actual total; once `pageSize` exceeds it, all items come back correctly (no truncation needed), which is what makes the off-by-one visible rather than a generic "limit is capped too low".
6. **Non-positive `pageSize` skips limiting entirely instead of being rejected.** `pageSize=0` and negative values like `pageSize=-1` both return the _entire_ result set, unbounded — unlike a non-integer `pageSize` (e.g. `"abc"`), which correctly gets rejected with `400`. Initially logged as a "design observation" (undocumented, not obviously wrong), then reclassified as a bug on review: bug 5 already proves the server _attempts_ to apply a limit for positive values (just gets the boundary wrong); silently skipping that attempt altogether for `<= 0` is an inconsistency in the same code path, not a deliberate design choice, and an unbounded query is a real operational risk regardless of intent.
7. **`nextPageToken` is never populated**, even when bug 5 truncates the results. There is currently no way to page through to the rest of the data once `pageSize` is smaller than the total — truncated claims are simply unreachable.
8. **`totalCount` is always `0`**, regardless of how many claims actually match (and are returned in `claims`).

**`GET /v1/claims/{id}`:**

9. **Sub-millisecond timestamp precision is lost on read.** `POST /v1/claims` returns `createdAt`/`updatedAt` with nanosecond precision (e.g. `...326511474Z`); a `GET` for that same claim right after returns the same instant truncated to millisecond precision (e.g. `...326Z`). Both are valid RFC3339 timestamps and represent the same moment, but the two endpoints don't agree on a representation for the same resource's same field — a client doing an exact string comparison between what it got from `POST` and a later `GET` would see a mismatch.

`DELETE /v1/claims/{id}` (`tests/integration/claims/delete-claim.spec.ts`) has no known bugs: deleting a claim returns `200` with `{}`, a subsequent `GET` correctly `404`s, and deleting an already-deleted or never-existing id both consistently return `404`/`code: 5`. This holds under real concurrent access too, not just sequentially: `tests/integration/contract/concurrency.spec.ts` fires 5 simultaneous `DELETE` requests at the same claim and confirms exactly one gets `200`, the rest `404` — no double-success, no crash, no inconsistent state (verified by direct probing with real concurrent curl requests, consistently, before writing the test).

## Design Observations (not bugs, requirements to clarify)

Things the live API does that aren't wrong per the documentation, but are worth flagging to the API owners rather than silently working around. Each is a living regression test — if the behavior changes, the test starts failing, which is the cue to revisit the note.

- **Unknown fields are silently accepted.** `v1CreateClaimRequest` only documents `title`/`description`/`claimantId`, but `POST /v1/claims` accepts a request carrying an extra, undocumented field and just drops it instead of rejecting it (e.g. with a `schema_mismatch`-style `400`). Whether unknown fields should be rejected is a requirements question, not something the test suite decides. (`tests/integration/contract/unexpected-fields.spec.ts`)
- **No maximum length on `title`/`description`.** A 10,000-character title is accepted with `200` — no documented or enforced limit. Worth flagging as a potential storage/abuse concern. (`tests/integration/claims/create-claim.spec.ts`)
- **No content-format validation on `title`/`description`/`claimantId`.** Non-alphabetic values like `"..."` or `"###$$$!!!"` are accepted with `200` for any of the three fields — no character-class or format rule is documented or enforced beyond "non-empty string". Worth flagging to the API owners: is any of these three fields expected to follow a particular format (e.g. `claimantId` matching an internal id pattern)? (`tests/integration/claims/create-claim.spec.ts`)
- **`Content-Type` isn't enforced.** A `POST /v1/claims` with a valid JSON body but a `text/plain` (or missing) `Content-Type` header still succeeds with `200`, instead of being rejected with `415`. (`tests/integration/errors/common.spec.ts`)
- **`pageToken` isn't validated.** Passing an arbitrary, never-issued string as `pageToken` is silently accepted and just returns the first page, rather than being rejected. Somewhat moot today since `nextPageToken` never comes back populated (bug 7), so there's no way to obtain a _real_ token to test the correct flow either way. (`tests/integration/claims/list-claims.spec.ts`)
- **No idempotency support.** Sending the exact same payload to `POST /v1/claims` twice creates two separate claims with two separate ids; no `Idempotency-Key`-style header is supported or documented. Worth flagging given retry-on-timeout is a common client pattern. (`tests/integration/contract/idempotency.spec.ts`)

## Deliberately Out of Scope

- **Rate limiting.** Unlike some APIs, this one documents no rate-limit policy in its swagger spec (no `429`/`Retry-After` semantics). A light, non-destructive burst (~30 concurrent `GET /v1/claims` requests) showed no throttling and no rate-limit response headers. Not tested further: there's no documented threshold to validate against, and the test API key is shared across whoever else is using this environment, so an unbounded brute-force probe risks disrupting them for no clear benefit.

## Adding New Tests

Before writing anything, check what already exists: a resource client under `api/clients/` (extending `BaseApiClient`), request/response types under `api/types/`, a test-data factory under `utils/testData/`, and a client fixture in `fixtures.ts` — reuse or extend these rather than duplicating them. Confirm the real behavior first: probe the live endpoint directly (e.g. `curl` with the `Authorization: Bearer <API_KEY>` header) for the happy path and the edge cases you plan to cover, rather than assuming from the Swagger spec. If what you find contradicts the documented contract, classify it as a real defect (a `test.fail()` regression test, logged under "Bugs Found") or a design observation (documented but not asserted as broken) — see those sections above for examples of both.

First decide which layer it belongs in: a new endpoint, error code or edge case goes in `tests/integration/<resource>/`; a new realistic multi-step business scenario goes in `tests/e2e/` (and should stay one of only a few). Cross-cutting checks that aren't about one endpoint's happy/error path go elsewhere: undocumented/edge behaviour → `tests/integration/contract/` (e.g. unexpected fields, idempotency); HTTP-framing errors that apply regardless of endpoint (malformed JSON, wrong `Content-Type`) → `tests/integration/errors/`; auth failures → `tests/integration/auth.spec.ts`.

Add a new `*.spec.ts` file under the relevant folder, importing shared code via the `@fixtures` / `@api/*` / `@utils/*` / `@config/*` aliases, not relative paths. Get a client from the `@fixtures` test (e.g. `claimsClient`) rather than the raw `request` fixture. If a new resource is introduced, add a new `api/clients/*Client.ts` (extending `BaseApiClient`) and matching types under `api/types/`, following the `ClaimsClient` pattern.

## Notes

AI assistance was used for well-structured documentation, for scaffolding the API clients, and for writing up test cases found through exploratory testing (Postman) against the live API.
