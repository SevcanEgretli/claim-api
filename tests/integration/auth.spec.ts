import { faker } from '@faker-js/faker';
import { test, expect } from '@fixtures';
import { baseURL } from '@config/env';
import { ClaimsClient } from '@api/clients/ClaimsClient';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { UnauthorizedErrorBodySchema } from '@api/types/common.types';

// The API's own error shape for 401s doesn't match the documented `rpcStatus` schema used by every
// other error response (see api/types/common.types.ts) — auth appears to be enforced by a gateway in
// front of the service, not the service itself.
test.describe('Authorization', () => {
  test('rejects a read request with no Authorization header', async ({ unauthenticatedClaimsClient }) => {
    const response = await unauthenticatedClaimsClient.listClaims();

    expect(response.status()).toBe(401);
    const error = UnauthorizedErrorBodySchema.parse(await response.json());
    expect(error.error).toBe('unauthorized');
  });

  test('rejects a write request with no Authorization header', async ({ unauthenticatedClaimsClient }) => {
    const response = await unauthenticatedClaimsClient.createClaim(validCreateClaimPayload());

    expect(response.status()).toBe(401);
  });

  test('rejects a request with an invalid token', async ({ playwright }) => {
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${faker.string.alphanumeric(20)}`,
      },
    });

    const response = await new ClaimsClient(context).listClaims();
    expect(response.status()).toBe(401);

    await context.dispose();
  });

  test('rejects a request using the wrong auth scheme', async ({ playwright }) => {
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { 'Content-Type': 'application/json', Authorization: 'Basic dGVzdDp0ZXN0' },
    });

    const response = await new ClaimsClient(context).listClaims();
    expect(response.status()).toBe(401);

    await context.dispose();
  });
});
