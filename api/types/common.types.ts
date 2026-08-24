import { z } from 'zod';

/** Error shape returned by the service itself (400/404/...), per the documented `rpcStatus` schema. */
export const RpcStatusSchema = z.object({
  code: z.number(),
  message: z.string(),
  details: z.array(z.unknown()),
});
export type RpcStatus = z.infer<typeof RpcStatusSchema>;

/** Error shape observed on 401 responses, which bypass the service and don't match RpcStatus. */
export const UnauthorizedErrorBodySchema = z.object({
  error: z.string(),
});
export type UnauthorizedErrorBody = z.infer<typeof UnauthorizedErrorBodySchema>;

/** A table-driven "invalid input -> expected error" test case. Overrides are `unknown` (not `Partial<TPayload>`) so wrong-type values (e.g. a number in a string field) can be tested too. */
export interface ValidationCase<TPayload> {
  name: string;
  overrides: Partial<Record<keyof TPayload, unknown>>;
  expectedMessageFragment: string;
}
