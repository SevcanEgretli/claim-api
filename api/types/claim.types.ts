import { z } from 'zod';

// zod schemas here, not just TS types: `const x: Claim = await response.json()` is a compile-time-only
// cast with zero runtime guarantee. `Schema.parse(...)` actually checks the shape, so API drift shows
// up as a real test failure.

export const ClaimStatusSchema = z.enum([
  'CLAIM_STATUS_UNSPECIFIED',
  'CLAIM_STATUS_PENDING',
  'CLAIM_STATUS_UNDER_REVIEW',
  'CLAIM_STATUS_APPROVED',
  'CLAIM_STATUS_REJECTED',
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const ClaimSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: ClaimStatusSchema,
  claimantId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const ListClaimsResponseSchema = z.object({
  claims: z.array(ClaimSchema),
  nextPageToken: z.string(),
  totalCount: z.number(),
});
export type ListClaimsResponse = z.infer<typeof ListClaimsResponseSchema>;

// Request shapes stay plain TS types — we author these ourselves, no drift risk to guard against.

export interface CreateClaimRequest {
  title: string;
  description: string;
  claimantId: string;
}

export interface UpdateClaimRequest {
  title?: string;
  description?: string;
  status?: ClaimStatus;
}

export interface ListClaimsParams {
  pageSize?: number;
  pageToken?: string;
  statusFilter?: ClaimStatus;
}
