import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import { ClaimSchema } from '@api/types/claim.types';
import type { CreateClaimRequest } from '@api/types/claim.types';
import { RpcStatusSchema } from '@api/types/common.types';
import type { ValidationCase } from '@api/types/common.types';

test.describe('POST /v1/claims', () => {
  test('creates a claim with the submitted data', async ({ claimsClient }) => {
    const payload = validCreateClaimPayload();

    const response = await claimsClient.createClaim(payload);

    expect(response.status()).toBe(200);
    const claim = ClaimSchema.parse(await response.json());
    expect(claim.id).toBeTruthy();
    expect(claim.title).toBe(payload.title);
    expect(claim.description).toBe(payload.description);
    expect(claim.claimantId).toBe(payload.claimantId);
    expect(claim.status).toBe('CLAIM_STATUS_APPROVED');
    expect(new Date(claim.createdAt).toString()).not.toBe('Invalid Date');
    expect(new Date(claim.updatedAt).toString()).not.toBe('Invalid Date');
  });

  const validationCases: ValidationCase<CreateClaimRequest>[] = [
    { name: 'an empty title', overrides: { title: '' }, expectedMessageFragment: 'title' },
    { name: 'an empty description', overrides: { description: '' }, expectedMessageFragment: 'description' },
    { name: 'an empty claimantId', overrides: { claimantId: '' }, expectedMessageFragment: 'claimant_id' },
    { name: 'a numeric title', overrides: { title: 12 }, expectedMessageFragment: 'invalid value for string type' },
    {
      name: 'a numeric description',
      overrides: { description: 12 },
      expectedMessageFragment: 'invalid value for string type',
    },
    {
      name: 'a numeric claimantId',
      overrides: { claimantId: 12 },
      expectedMessageFragment: 'invalid value for string type',
    },
  ];

  for (const { name, overrides, expectedMessageFragment } of validationCases) {
    test(`rejects a claim with ${name}`, async ({ claimsClient }) => {
      const payload = validCreateClaimPayload(overrides);

      const response = await claimsClient.createClaim(payload);

      expect(response.status()).toBe(400);
      const error = RpcStatusSchema.parse(await response.json());
      expect(error.code).toBe(3);
      expect(error.message).toContain(expectedMessageFragment);
    });
  }
});

// Design observations, not bugs: no length or content-format rules are documented for
// title/description/claimantId, and none appear to be enforced — worth flagging to the API owners.
test.describe('POST /v1/claims - design observations', () => {
  test('accepts a very long title with no apparent length limit', async ({ claimsClient }) => {
    const payload = validCreateClaimPayload({ title: 'A'.repeat(10_000) });

    const response = await claimsClient.createClaim(payload);

    expect(response.status()).toBe(200);
  });

  const nonAlphabeticCases: { name: string; overrides: Partial<CreateClaimRequest> }[] = [
    { name: 'title', overrides: { title: '...' } },
    { name: 'description', overrides: { description: '###$$$!!!' } },
    { name: 'claimantId', overrides: { claimantId: '!!!???' } },
  ];

  for (const { name, overrides } of nonAlphabeticCases) {
    test(`accepts a non-alphabetic ${name} with no apparent format validation`, async ({ claimsClient }) => {
      const payload = validCreateClaimPayload(overrides);

      const response = await claimsClient.createClaim(payload);

      expect(response.status()).toBe(200);
    });
  }
});
