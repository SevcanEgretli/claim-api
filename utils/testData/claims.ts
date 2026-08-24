import { faker } from '@faker-js/faker';
import type { CreateClaimRequest } from '@api/types/claim.types';

// overrides is typed loosely (not Partial<CreateClaimRequest>) so callers can deliberately pass a
// wrong-type value (e.g. a number) to build negative-test payloads through the same factory.
export const validCreateClaimPayload = (
  overrides: Partial<Record<keyof CreateClaimRequest, unknown>> = {},
): CreateClaimRequest =>
  ({
    title: `QA_Title_${faker.lorem.words({ min: 2, max: 4 })}`,
    description: `QA_desc_${faker.lorem.sentence({ min: 1, max: 3 })}`,
    claimantId: `CLM-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`,
    ...overrides,
  }) as CreateClaimRequest;
