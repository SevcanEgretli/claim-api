# Contributing

## Conventions

**API clients are required.** Tests never call `request.get/post/...` directly — always through a typed client under `api/clients/`, one class per resource. This is a strict rule, not just a habit: it keeps every request typed, keeps endpoint knowledge in one place, and makes adding a new resource simple — just one more client and spec folder, no new pattern to invent.

**Two layers, on purpose.** `tests/integration/` holds most of the suite: many small tests, each pinned to one endpoint's behaviour. `tests/e2e/` stays small: a handful of tests that each walk through one full, realistic flow.

**Path aliases.** Shared code is imported via `@fixtures`, `@api/*`, `@utils/*`, and `@config/*` (set up in `tsconfig.json`'s `paths`, resolved natively by Playwright) instead of relative paths like `../../../api/clients/ClaimsClient`.

## Adding a new test

Before writing anything, check what already exists: a resource client under `api/clients/` (extending `BaseApiClient`), request/response types under `api/types/`, a test-data factory under `utils/testData/`, and a client fixture in `fixtures.ts`. Reuse or extend these instead of duplicating them. Confirm the real behavior first: probe the live endpoint directly (e.g. `curl` with the `Authorization: Bearer <API_KEY>` header) for the happy path and the edge cases you plan to cover, rather than assuming from the Swagger spec. If what you find contradicts the documented contract, classify it as a real defect (a `test.fail()` regression test, logged under [README.md § Bugs Found](README.md#bugs-found)) or a design observation (documented but not asserted as broken, see [README.md § Design Observations](README.md#design-observations-not-bugs-requirements-to-clarify)).

First decide which layer it belongs in: a new endpoint, error code, or edge case goes in `tests/integration/<resource>/`; a new realistic multi-step business scenario goes in `tests/e2e/` (and should stay one of only a few). Cross-cutting checks that aren't about one endpoint's happy/error path go elsewhere: undocumented/edge behavior → `tests/integration/contract/` (e.g. unexpected fields, idempotency); HTTP-framing errors that apply regardless of endpoint (malformed JSON, wrong `Content-Type`) → `tests/integration/errors/`; auth failures → `tests/integration/auth.spec.ts`.

Add a new `*.spec.ts` file under the relevant folder, importing shared code via the `@fixtures` / `@api/*` / `@utils/*` / `@config/*` aliases, not relative paths. Get a client from the `@fixtures` test (e.g. `claimsClient`) rather than the raw `request` fixture. If a new resource is introduced, add a new `api/clients/*Client.ts` (extending `BaseApiClient`) and matching types under `api/types/`, following the `ClaimsClient` pattern.
