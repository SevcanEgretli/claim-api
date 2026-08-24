# API Understanding

Summary of how the Claim Service API actually behaves, built by reading the Swagger spec and then confirming (or correcting) each point against the live service. Where the two disagree, this doc follows the live behavior — see [README.md § Bugs Found](../README.md#bugs-found) and [§ Design Observations](../README.md#design-observations-not-bugs-requirements-to-clarify) for the full list of confirmed divergences.

## Authentication

Every request requires a `Bearer` token in the `Authorization` header. A missing, invalid, or wrong-scheme token returns `401` — but with a different error shape (`{ "error": "unauthorized" }`) than every other error response in the API, which suggests auth is enforced by a gateway in front of the service rather than the service itself (see `api/types/common.types.ts`'s `UnauthorizedErrorBodySchema` vs. `RpcStatusSchema`).

## Resource: Claim

| Field         | Type                                                                                              | Notes                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `id`          | `string`                                                                                          | server-generated                                                        |
| `title`       | `string`                                                                                          | required on create; no documented or enforced max length                |
| `description` | `string`                                                                                          | required on create; no documented or enforced max length                |
| `status`      | `enum`: `CLAIM_STATUS_UNSPECIFIED` \| `_PENDING` \| `_UNDER_REVIEW` \| `_APPROVED` \| `_REJECTED` | in practice only `_APPROVED` is reachable — see README bug 1            |
| `claimantId`  | `string`                                                                                          | no documented or enforced format                                        |
| `createdAt`   | `string` (RFC3339)                                                                                | nanosecond precision on `POST`, millisecond on `GET` — see README bug 9 |
| `updatedAt`   | `string` (RFC3339)                                                                                | does not change on `PATCH` — see README bug 4                           |

Full runtime schema: `api/types/claim.types.ts` (`ClaimSchema`, validated with zod at test time, not just cast at compile time).

## Endpoints

| Method   | Path              | Purpose                                                            |
| -------- | ----------------- | ------------------------------------------------------------------ |
| `POST`   | `/v1/claims`      | create a claim                                                     |
| `GET`    | `/v1/claims/{id}` | fetch a single claim by id                                         |
| `GET`    | `/v1/claims`      | list claims — supports `pageSize`, `pageToken`, `statusFilter`     |
| `PATCH`  | `/v1/claims/{id}` | partially update a claim (documented as partial; see README bug 2) |
| `DELETE` | `/v1/claims/{id}` | delete a claim                                                     |

## Error Shapes

- **`RpcStatus`** (`{ code, message, details }`) — the shape for every error the service itself returns (`400`, `404`, ...). `code` is a raw gRPC status code (`3` = `INVALID_ARGUMENT`, `5` = `NOT_FOUND`), not mapped to a REST-idiomatic vocabulary.
- **`UnauthorizedErrorBody`** (`{ error }`) — the shape for `401`s only, which come from the gateway, not the service (see Authentication above).

Full schemas: `api/types/common.types.ts`.

## Backend Architecture (Inferred)

The API is documented as a plain REST/JSON service, but response headers and error message formats reveal it's actually a **gRPC service exposed through a REST gateway** (the [grpc-gateway](https://github.com/grpc-ecosystem/grpc-gateway) pattern, common in Go microservices) — none of this is stated in the Swagger spec, it was inferred from evidence while investigating other findings:

- Every successful response carries a `grpc-metadata-content-type: application/grpc` header — an artifact of the underlying gRPC response being forwarded through the gateway.
- Malformed-input error messages come back in gRPC's own wire-format vocabulary, e.g. `"proto: (line 1:10): invalid value for string type: 12"` and `"parsing field \"page_size\": strconv.ParseInt: ..."` — not typical REST/JSON-schema-validator phrasing.
- The `code` field in every `RpcStatus` error response (`3`, `5`, ...) is a [gRPC status code](https://grpc.io/docs/guides/status-codes/) (`INVALID_ARGUMENT`, `NOT_FOUND`), reused as-is rather than mapped to a REST-idiomatic error vocabulary.

Nothing the test suite can act on directly — there's no `.proto` file or gRPC endpoint exposed to us, only the REST gateway — but it explains otherwise-odd behavior (e.g. why validation messages read like protobuf unmarshalling errors rather than field-level REST validation messages) and is worth knowing before extending this suite or introducing a second service's client.

## Assumptions

- Started from the Swagger spec, but treated it as a starting point, not ground truth — every assertion in the suite was confirmed against the live API first (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
- `pageSize`, `pageToken`, and `statusFilter` are assumed to be the only list-filtering parameters — none others are documented.
- No documented rate-limit policy; a light non-destructive probe showed no throttling, but this wasn't pushed further since the test API key is shared with other users of the environment (see [README.md § Decisions & Trade-offs](../README.md#decisions--trade-offs)).
