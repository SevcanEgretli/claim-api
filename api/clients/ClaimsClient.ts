import { APIResponse } from '@playwright/test';
import { BaseApiClient } from './BaseApiClient';
import type { CreateClaimRequest, ListClaimsParams, UpdateClaimRequest } from '../types/claim.types';

export class ClaimsClient extends BaseApiClient {
  createClaim(payload: Partial<CreateClaimRequest>): Promise<APIResponse> {
    return this.post('/v1/claims', payload);
  }

  /** Escape hatch for negative tests that need to send a raw body (e.g. malformed JSON) or override headers (e.g. Content-Type) — bypasses request-shape typing entirely. */
  createClaimRaw(body: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    return this.post('/v1/claims', body, headers);
  }

  getClaim(id: string): Promise<APIResponse> {
    return this.get(`/v1/claims/${id}`);
  }

  listClaims(params?: ListClaimsParams): Promise<APIResponse> {
    return this.get('/v1/claims', params as Record<string, string | number | boolean> | undefined);
  }

  updateClaim(id: string, payload: UpdateClaimRequest): Promise<APIResponse> {
    return this.patch(`/v1/claims/${id}`, payload);
  }

  deleteClaim(id: string): Promise<APIResponse> {
    return this.delete(`/v1/claims/${id}`);
  }
}
