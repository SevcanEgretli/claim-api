import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema, ListClaimsResponseSchema } from '@api/types/claim.types';
import type { ClaimStatus, ListClaimsResponse } from '@api/types/claim.types';
import { RpcStatusSchema } from '@api/types/common.types';

test.describe('GET /v1/claims', () => {
  test('includes a just-created claim in the list', async ({ claimsClient }) => {
    const payload = validCreateClaimPayload();
    const created = ClaimSchema.parse(await (await claimsClient.createClaim(payload)).json());

    const response = await claimsClient.listClaims({ pageSize: 1000 });

    expect(response.status()).toBe(200);
    const body = ListClaimsResponseSchema.parse(await response.json());
    const found = body.claims.find((claim) => claim.id === created.id);
    expect(found).toMatchObject({
      title: payload.title,
      description: payload.description,
      claimantId: payload.claimantId,
    });
  });

  test('statusFilter=CLAIM_STATUS_APPROVED includes a just-created claim', async ({ claimsClient }) => {
    // Every claim is created as CLAIM_STATUS_APPROVED (see create-claim.spec.ts), so this is currently
    // the only status the filter can be meaningfully exercised against — PATCH can't move a claim to
    // any other status (see update-claim.spec.ts's known bugs).
    const created = ClaimSchema.parse(await (await claimsClient.createClaim(validCreateClaimPayload())).json());

    const response = await claimsClient.listClaims({ pageSize: 1000, statusFilter: 'CLAIM_STATUS_APPROVED' });

    const body = ListClaimsResponseSchema.parse(await response.json());
    expect(body.claims.some((claim) => claim.id === created.id)).toBe(true);
    expect(body.claims.every((claim) => claim.status === 'CLAIM_STATUS_APPROVED')).toBe(true);
  });

  test('rejects a non-integer pageSize with 400', async ({ claimsClient }) => {
    const response = await claimsClient.listClaims({ pageSize: 'abc' as unknown as number });

    expect(response.status()).toBe(400);
    const error = RpcStatusSchema.parse(await response.json());
    expect(error.code).toBe(3);
  });

  test('rejects an unrecognized statusFilter value with 400', async ({ claimsClient }) => {
    const response = await claimsClient.listClaims({ statusFilter: 'NOT_A_REAL_STATUS' as ClaimStatus });

    expect(response.status()).toBe(400);
    const error = RpcStatusSchema.parse(await response.json());
    expect(error.code).toBe(3);
  });
});

// Design observation, not a bug: undocumented pageToken edge-case handling that doesn't contradict the
// spec (no documented pageToken validation), but is worth flagging to the API owners.
test.describe('GET /v1/claims - design observations', () => {
  test('an unrecognized pageToken is silently ignored rather than rejected', async ({ claimsClient }) => {
    const response = await claimsClient.listClaims({ pageToken: 'not-a-real-token' });

    expect(response.status()).toBe(200);
  });
});

test.describe('GET /v1/claims - known bugs', () => {
  // Same family as the pageSize off-by-one below: a positive pageSize gets a (buggy) limit applied to
  // it at all, but pageSize<=0 skips limiting entirely and returns everything, unbounded. Expected
  // behavior is inferred by consistency with the sibling "non-integer pageSize" test above (in the main
  // describe), which does get validated with a 400 — there's no reason 0/negative should be exempt.
  test('BUG: pageSize=0 is treated as "no limit" instead of being rejected', async ({ claimsClient }) => {
    test.fail();

    const response = await claimsClient.listClaims({ pageSize: 0 });

    expect(response.status()).toBe(400);
  });

  test('BUG: a negative pageSize is treated as "no limit" instead of being rejected', async ({ claimsClient }) => {
    test.fail();

    const response = await claimsClient.listClaims({ pageSize: -1 });

    expect(response.status()).toBe(400);
  });

  test('BUG: totalCount is always reported as 0', async ({ claimsClient }) => {
    test.fail();

    await claimsClient.createClaim(validCreateClaimPayload());

    const response = await claimsClient.listClaims();
    const body: ListClaimsResponse = await response.json();

    expect(body.totalCount).toBeGreaterThan(0);
  });

  test('BUG: pageSize returns one fewer claim than requested', async ({ claimsClient }) => {
    test.fail();

    // Guarantee at least one claim exists, then derive pageSize from what's actually there instead of
    // assuming a fixed count, so the test holds regardless of what else lives in the shared environment.
    await claimsClient.createClaim(validCreateClaimPayload());
    const fullList: ListClaimsResponse = await (await claimsClient.listClaims({ pageSize: 3 })).json();
    const totalAvailable = fullList.claims.length;

    const limited: ListClaimsResponse = await (await claimsClient.listClaims({ pageSize: totalAvailable })).json();

    expect(limited.claims).toHaveLength(totalAvailable);
  });

  test('BUG: nextPageToken stays empty even when results are truncated', async ({ claimsClient }) => {
    test.fail();

    // Create two of our own so there's a guaranteed truncation point (totalAvailable - 1 >= 1) regardless
    // of what else lives in the shared environment.
    await Promise.all([
      claimsClient.createClaim(validCreateClaimPayload()),
      claimsClient.createClaim(validCreateClaimPayload()),
    ]);
    const fullList: ListClaimsResponse = await (await claimsClient.listClaims({ pageSize: 1000 })).json();
    const totalAvailable = fullList.claims.length;

    const limited: ListClaimsResponse = await (await claimsClient.listClaims({ pageSize: totalAvailable - 1 })).json();

    expect(limited.nextPageToken).not.toBe('');
  });
});
