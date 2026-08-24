import { APIRequestContext, APIResponse } from '@playwright/test';

/** Thin wrapper around Playwright's request context. Subclass per resource (e.g. ClaimsClient) and add typed, named methods per endpoint. */
export abstract class BaseApiClient {
  constructor(protected readonly request: APIRequestContext) {}

  protected get(path: string, params?: Record<string, string | number | boolean>): Promise<APIResponse> {
    return this.request.get(path, { params });
  }

  protected post(path: string, data?: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    return this.request.post(path, { data, headers });
  }

  protected patch(path: string, data?: unknown): Promise<APIResponse> {
    return this.request.patch(path, { data });
  }

  protected delete(path: string): Promise<APIResponse> {
    return this.request.delete(path);
  }
}
