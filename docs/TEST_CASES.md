# Test Cases

Test cases derived from the API's behavior (see [docs/API_UNDERSTANDING.md](API_UNDERSTANDING.md)), grouped into the three categories below. Every case is implemented in `tests/` — file references point to the exact spec. Where a case surfaced a confirmed defect, only a one-line summary is given here; the full write-up is in [README.md § Bugs Found](../README.md#bugs-found).

## Happy Path Tests

- **Create a claim** — `POST /v1/claims` with a valid `title`/`description`/`claimantId` returns `200` with the created resource. (`claims/create-claim.spec.ts`)
- **Get a claim** — `GET /v1/claims/{id}` returns the claim matching the id. (`claims/get-claim.spec.ts`)
- **Delete a claim** — `DELETE /v1/claims/{id}` returns `200`; a follow-up `GET` then `404`s. (`claims/delete-claim.spec.ts`)
- **Full lifecycle (e2e)** — create → find it via `GET` → delete it, as one continuous flow. (`e2e/claim-lifecycle.spec.ts`)
- **Concurrent delete safety** — 5 simultaneous `DELETE`s on the same claim: exactly one succeeds, the rest correctly `404`. (`contract/concurrency.spec.ts`)

## Negative / Validation Tests

**Missing or invalid required fields (create)**

- Empty `title`, `description`, or `claimantId` → rejected with `400`.
- Numeric (wrong-type) `title`, `description`, or `claimantId` → rejected with `400`. (`claims/create-claim.spec.ts`)

**Invalid status transition (update)**

- `PATCH .../{id}` with `{"status": "CLAIM_STATUS_PENDING"}` is expected to move the claim to that status; instead the API returns `200` but silently leaves the status unchanged — a confirmed bug, not the intended behavior. (`claims/update-claim.spec.ts`)
- `PATCH` clearing a required field (`title`/`description` set to `""`, or omitted) is expected to be rejected with `400`; instead it returns `200` and wipes the field. (`claims/update-claim.spec.ts`)

**Not found**

- `GET` or `DELETE` on a non-existent id → `404`. (`claims/get-claim.spec.ts`, `claims/delete-claim.spec.ts`)

**Authentication**

- No `Authorization` header on a read or write request → `401`.
- Invalid token, or wrong auth scheme (`Basic` instead of `Bearer`) → `401`. (`auth.spec.ts`)

**Malformed / duplicate requests**

- Malformed JSON body → `400`. (`errors/common.spec.ts`)
- A rejected submission leaves no trace in the system (nothing is created). (`e2e/failed-claim-submission.spec.ts`)
- Same payload posted twice → creates two separate claims; no idempotency protection. (`contract/idempotency.spec.ts`)

## List / Filter Tests

- **Includes newly created claims** — a just-created claim appears in `GET /v1/claims`. (`claims/list-claims.spec.ts`)
- **`statusFilter`** — `statusFilter=CLAIM_STATUS_APPROVED` returns a just-created claim; an unrecognized value → `400`. (`claims/list-claims.spec.ts`)
- **`pageSize` validation** — a non-integer value → `400`; `0` or a negative value is expected to be rejected the same way but instead returns the full, unbounded result set. (`claims/list-claims.spec.ts`)
- **`pageSize` pagination** — expected to return exactly `pageSize` items; found it consistently returns one fewer. (`claims/list-claims.spec.ts`)
- **`pageToken`** — an unrecognized token is silently ignored (returns page 1) rather than rejected. (`claims/list-claims.spec.ts`)
- **`nextPageToken`** — expected to be populated whenever results are truncated; found it's never populated. (`claims/list-claims.spec.ts`)
- **`totalCount`** — expected to reflect the real match count; found it's always `0`. (`claims/list-claims.spec.ts`)
- **Filtering by post-update status** — `statusFilter=CLAIM_STATUS_PENDING`/`_UNDER_REVIEW`/`_REJECTED` can't be exercised end-to-end today, blocked by the invalid-status-transition bug above. (`contract/status-filter-coverage.spec.ts`)

---

**Coverage:** 44 automated tests in `tests/` implement the cases above — 31 pass as ordinary assertions, 13 are `test.fail()` regression tests pinned to a confirmed defect (run separately via `npm run test:bugs`).
