import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema } from '@api/types/claim.types';

// Design observation, not a bug: schema only documents title/description/claimantId, but an extra field
// gets silently dropped instead of rejected (e.g. schema_mismatch 400). Not ours to decide if that's
// wrong. Living regression test — if this starts failing, revisit.
test.describe('POST /v1/claims - unexpected fields', () => {
  test('silently accepts and drops a field outside the documented schema', async ({ claimsClient }) => {
    const payload = validCreateClaimPayload();
    const payloadWithExtraField = { ...payload, unexpectedField: 'surprise' };

    const response = await claimsClient.createClaim(payloadWithExtraField);

    expect(response.status()).toBe(200);
    const rawBody = await response.json();
    // Raw body, not the zod-parsed one — .parse() strips unknown keys, which would make this pass
    // regardless of what the server actually sent.
    expect('unexpectedField' in rawBody).toBe(false);
    const claim = ClaimSchema.parse(rawBody);
    expect(claim.title).toBe(payload.title);
  });
});
