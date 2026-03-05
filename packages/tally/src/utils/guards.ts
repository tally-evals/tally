// ============================================================================
// Type Guards using ts-pattern
// ============================================================================

import { Conversation, DatasetItem } from '@tally-evals/core';
import { match, P } from 'ts-pattern';

/**
 * Type-safe container matching using ts-pattern
 */
export const isConversation = (value: unknown): value is Conversation =>
  match(value)
    .with(
      {
        id: P.string,
        steps: P.array(P.any),
      },
      () => true,
    )
    .otherwise(() => false);

export const isDatasetItem = (value: unknown): value is DatasetItem =>
  match(value)
    .with(
      {
        id: P.string,
        prompt: P.string,
        completion: P.string,
      },
      () => true,
    )
    .otherwise(() => false);
