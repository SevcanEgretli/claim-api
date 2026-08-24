import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { RpcStatusSchema } from '@api/types/common.types';

test.describe('POST /v1/claims - malformed request body', () => {
  test('rejects a malformed JSON body with 400', async ({ claimsClient }) => {
    const response = await claimsClient.createClaimRaw('{ this is not valid json');

    expect(response.status()).toBe(400);
    const error = RpcStatusSchema.parse(await response.json());
    expect(error.code).toBe(3);
  });
});

// Design observation, not a bug: the API parses the request body as JSON regardless of the declared
// Content-Type (or its absence), instead of rejecting a non-JSON content type with a 415. Whether
// Content-Type should be enforced is a requirements question for the API owners.
test.describe('POST /v1/claims - Content-Type leniency', () => {
  test('accepts a valid JSON body even with a non-JSON Content-Type header', async ({ claimsClient }) => {
    const payload = validCreateClaimPayload();

    const response = await claimsClient.createClaimRaw(JSON.stringify(payload), { 'Content-Type': 'text/plain' });

    expect(response.status()).toBe(200);
  });
});
