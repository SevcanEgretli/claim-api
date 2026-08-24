import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema } from '@api/types/claim.types';

// Design observation, not a bug: no idempotency mechanism (e.g. Idempotency-Key header) is documented
// or supported. Same payload posted twice → two separate claims. Risk for a claims system: a network
// timeout + client retry could double-submit the same claim.
test.describe('POST /v1/claims - idempotency', () => {
  test('sending the same payload twice creates two separate claims', async ({ claimsClient }) => {
    const payload = validCreateClaimPayload();

    const first = ClaimSchema.parse(await (await claimsClient.createClaim(payload)).json());
    const second = ClaimSchema.parse(await (await claimsClient.createClaim(payload)).json());

    expect(second.id).not.toBe(first.id);
  });
});
