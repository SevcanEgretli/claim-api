import { APIResponse, test as base, expect } from '@playwright/test';
import { ClaimsClient } from './api/clients/ClaimsClient';
import type { CreateClaimRequest } from './api/types/claim.types';
import { baseURL } from './config/env';

/** Tracks every claim it creates (through any create-like method) and deletes them all when the test ends, so individual tests don't need manual cleanup. */
class TrackingClaimsClient extends ClaimsClient {
  private readonly createdIds: string[] = [];

  private async trackIfCreated(response: Promise<APIResponse>): Promise<APIResponse> {
    const res = await response;
    if (res.ok()) {
      const { id } = (await res.json()) as { id: string };
      this.createdIds.push(id);
    }
    return res;
  }

  override createClaim(payload: Partial<CreateClaimRequest>): Promise<APIResponse> {
    return this.trackIfCreated(super.createClaim(payload));
  }

  override createClaimRaw(body: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    return this.trackIfCreated(super.createClaimRaw(body, headers));
  }

  async cleanup(): Promise<void> {
    await Promise.all(this.createdIds.map((id) => this.deleteClaim(id)));
  }
}

type Fixtures = {
  claimsClient: ClaimsClient;
  /** A client backed by a request context with no Authorization header, for testing auth failures. */
  unauthenticatedClaimsClient: ClaimsClient;
};

export const test = base.extend<Fixtures>({
  claimsClient: async ({ request }, use) => {
    const client = new TrackingClaimsClient(request);
    await use(client);
    await client.cleanup();
  },

  unauthenticatedClaimsClient: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
    await use(new ClaimsClient(context));
    await context.dispose();
  },
});

export { expect };
