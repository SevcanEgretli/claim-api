import { faker } from '@faker-js/faker';
import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema } from '@api/types/claim.types';
import { RpcStatusSchema } from '@api/types/common.types';

test.describe('DELETE /v1/claims/{id}', () => {
  test('deletes a claim, which can no longer be retrieved afterwards', async ({ claimsClient }) => {
    const created = ClaimSchema.parse(await (await claimsClient.createClaim(validCreateClaimPayload())).json());

    const deleteResponse = await claimsClient.deleteClaim(created.id);

    expect(deleteResponse.status()).toBe(200);
    expect(await deleteResponse.json()).toEqual({});

    const getResponse = await claimsClient.getClaim(created.id);
    expect(getResponse.status()).toBe(404);
  });

  test('returns 404 for an id that does not exist', async ({ claimsClient }) => {
    const response = await claimsClient.deleteClaim(faker.database.mongodbObjectId());

    expect(response.status()).toBe(404);
    const error = RpcStatusSchema.parse(await response.json());
    expect(error.code).toBe(5);
    expect(error.message).toContain('not found');
  });
});
