import { test, expect } from '@fixtures';
import { validCreateClaimPayload } from '@utils/testData/claims';
import type { Claim, ClaimStatus, ListClaimsResponse } from '@api/types/claim.types';

// Every claim is created APPROVED and PATCH can't move it elsewhere (bug 1, update-claim.spec.ts), so
// none of these can reach the state being filtered for. test.fail() instead of skipped — once bug 1 is
// fixed, each flips to "unexpectedly passed", the cue to promote it to a real assertion.
// APPROVED itself is covered (and passes) in list-claims.spec.ts.
const statusesReachableOnlyViaPatch: ClaimStatus[] = [
  'CLAIM_STATUS_PENDING',
  'CLAIM_STATUS_UNDER_REVIEW',
  'CLAIM_STATUS_REJECTED',
];

test.describe('GET /v1/claims - statusFilter coverage blocked by PATCH bug 1', () => {
  for (const status of statusesReachableOnlyViaPatch) {
    test(`BUG: statusFilter=${status} finds a claim moved to that status`, async ({ claimsClient }) => {
      test.fail();

      const created: Claim = await (await claimsClient.createClaim(validCreateClaimPayload())).json();
      await claimsClient.updateClaim(created.id, { status });

      const response = await claimsClient.listClaims({ pageSize: 1000, statusFilter: status });
      const body: ListClaimsResponse = await response.json();

      expect(body.claims.some((claim) => claim.id === created.id)).toBe(true);
    });
  }
});
