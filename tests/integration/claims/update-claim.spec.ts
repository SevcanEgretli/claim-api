import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import type { Claim } from '@api/types/claim.types';

// Known bugs in PATCH /v1/claims/{id}, kept as living regression tests (test.fail()): the suite stays
// green while these are open, but a test flips to "unexpectedly passed" (failing the run) the moment
// either bug is fixed. See README's "Bugs Found" section. Ground truth is read via a follow-up GET,
// not the PATCH response itself, because the PATCH response echoes stale (pre-update) values.
test.describe('PATCH /v1/claims/{id} - known bugs', () => {
  test('BUG: a status change is silently ignored', async ({ claimsClient }) => {
    test.fail();

    const created: Claim = await (await claimsClient.createClaim(validCreateClaimPayload())).json();

    await claimsClient.updateClaim(created.id, { status: 'CLAIM_STATUS_PENDING' });
    const refetched: Claim = await (await claimsClient.getClaim(created.id)).json();

    expect(refetched.status).toBe('CLAIM_STATUS_PENDING');
  });

  test('BUG: omitting a field wipes it instead of leaving it unchanged', async ({ claimsClient }) => {
    test.fail();

    const payload = validCreateClaimPayload();
    const created: Claim = await (await claimsClient.createClaim(payload)).json();

    await claimsClient.updateClaim(created.id, { status: 'CLAIM_STATUS_PENDING' });
    const refetched: Claim = await (await claimsClient.getClaim(created.id)).json();

    expect(refetched.title).toBe(payload.title);
    expect(refetched.description).toBe(payload.description);
  });

  // POST /v1/claims rejects an empty title/description with a 400 (see create-claim.spec.ts), but
  // PATCH applies no such validation: both explicitly empty and entirely omitted required fields
  // (the latter already covered above) are silently accepted with a 200.
  test('BUG: clearing a required field returns 200 instead of a validation error', async ({ claimsClient }) => {
    test.fail();

    const created: Claim = await (await claimsClient.createClaim(validCreateClaimPayload())).json();

    const response = await claimsClient.updateClaim(created.id, { title: '', description: '' });

    expect(response.status()).toBe(400);
  });

  test('BUG: updatedAt does not change after a PATCH', async ({ claimsClient }) => {
    test.fail();

    const created: Claim = await (await claimsClient.createClaim(validCreateClaimPayload())).json();

    await claimsClient.updateClaim(created.id, { status: 'CLAIM_STATUS_PENDING' });
    const refetched: Claim = await (await claimsClient.getClaim(created.id)).json();

    expect(refetched.updatedAt).not.toBe(refetched.createdAt);
  });
});
