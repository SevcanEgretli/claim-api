import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ListClaimsResponseSchema } from '@api/types/claim.types';
import { RpcStatusSchema } from '@api/types/common.types';

test('a rejected claim submission leaves no trace in the system', async ({ claimsClient }) => {
  const payload = validCreateClaimPayload({ title: '' });

  const response = await claimsClient.createClaim(payload);

  expect(response.status()).toBe(400);
  const error = RpcStatusSchema.parse(await response.json());
  expect(error.code).toBe(3);
  expect(error.message).toContain('title');

  // No id comes back from a failed create, so we can't check by id like the happy-path e2e does —
  // the payload's faker-generated claimantId is unique enough to serve as a fingerprint instead,
  // proving the rejected attempt was never actually persisted anywhere, not just that POST said 400.
  const listResponse = await claimsClient.listClaims({ pageSize: 1000 });
  const listBody = ListClaimsResponseSchema.parse(await listResponse.json());
  expect(listBody.claims.some((claim) => claim.claimantId === payload.claimantId)).toBe(false);
});
