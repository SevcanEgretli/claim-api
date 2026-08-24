import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema, ListClaimsResponseSchema } from '@api/types/claim.types';

test('a claim can be created, found through the API, and removed', async ({ claimsClient }) => {
  const payload = validCreateClaimPayload();

  const createResponse = await claimsClient.createClaim(payload);
  expect(createResponse.status()).toBe(200);
  const created = ClaimSchema.parse(await createResponse.json());
  expect(created.status).toBe('CLAIM_STATUS_APPROVED');

  const listResponse = await claimsClient.listClaims({ pageSize: 1000 });
  const listBody = ListClaimsResponseSchema.parse(await listResponse.json());
  expect(listBody.claims.some((claim) => claim.id === created.id)).toBe(true);

  const getResponse = await claimsClient.getClaim(created.id);
  expect(getResponse.status()).toBe(200);
  const fetched = ClaimSchema.parse(await getResponse.json());
  expect(fetched).toMatchObject({
    id: created.id,
    title: payload.title,
    description: payload.description,
    claimantId: payload.claimantId,
  });

  const deleteResponse = await claimsClient.deleteClaim(created.id);
  expect(deleteResponse.status()).toBe(200);

  const getAfterDelete = await claimsClient.getClaim(created.id);
  expect(getAfterDelete.status()).toBe(404);

  const listAfterDelete = await claimsClient.listClaims({ pageSize: 1000 });
  const listAfterDeleteBody = ListClaimsResponseSchema.parse(await listAfterDelete.json());
  expect(listAfterDeleteBody.claims.some((claim) => claim.id === created.id)).toBe(false);
});
