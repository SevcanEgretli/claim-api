import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema } from '@api/types/claim.types';

// Tests the API's own behavior under concurrent access, not our suite's isolation from itself
// (see README's "Single worker, on purpose" — different concern).
test.describe('DELETE /v1/claims/{id} - concurrent access', () => {
  test('exactly one of several simultaneous deletes for the same claim succeeds', async ({ claimsClient }) => {
    const created = ClaimSchema.parse(await (await claimsClient.createClaim(validCreateClaimPayload())).json());

    const responses = await Promise.all(Array.from({ length: 5 }, () => claimsClient.deleteClaim(created.id)));
    const statuses = responses.map((response) => response.status());

    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 404)).toHaveLength(statuses.length - 1);
  });
});
