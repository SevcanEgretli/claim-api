import { faker } from '@faker-js/faker';
import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema } from '@api/types/claim.types';
import type { Claim } from '@api/types/claim.types';
import { RpcStatusSchema } from '@api/types/common.types';

test.describe('GET /v1/claims/{id}', () => {
  test('returns the claim matching the id', async ({ claimsClient }) => {
    const payload = validCreateClaimPayload();
    const created = ClaimSchema.parse(await (await claimsClient.createClaim(payload)).json());

    const response = await claimsClient.getClaim(created.id);

    expect(response.status()).toBe(200);
    const claim = ClaimSchema.parse(await response.json());
    // createdAt/updatedAt are compared by instant, not string, because GET truncates the sub-millisecond
    // precision POST returns for the same resource (see the known-bugs describe block below).
    expect(claim).toMatchObject({
      id: created.id,
      title: created.title,
      description: created.description,
      claimantId: created.claimantId,
      status: created.status,
    });
    expect(new Date(claim.createdAt).getTime()).toBe(new Date(created.createdAt).getTime());
    expect(new Date(claim.updatedAt).getTime()).toBe(new Date(created.updatedAt).getTime());
  });

  test('returns 404 for an id that does not exist', async ({ claimsClient }) => {
    const response = await claimsClient.getClaim(faker.database.mongodbObjectId());

    expect(response.status()).toBe(404);
    const error = RpcStatusSchema.parse(await response.json());
    expect(error.code).toBe(5);
    expect(error.message).toContain('not found');
  });
});

test.describe('GET /v1/claims/{id} - known bugs', () => {
  test('BUG: GET truncates the sub-millisecond precision POST returns for the same resource', async ({
    claimsClient,
  }) => {
    test.fail();

    const created: Claim = await (await claimsClient.createClaim(validCreateClaimPayload())).json();
    const refetched: Claim = await (await claimsClient.getClaim(created.id)).json();

    expect(refetched.createdAt).toBe(created.createdAt);
  });
});
