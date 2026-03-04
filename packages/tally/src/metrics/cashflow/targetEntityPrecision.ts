/**
 * Target Entity Precision Metric
 *
 * A code-based metric (can be single or multi-turn) that measures whether update
 * operations affect the correct target entity and not similar or unrelated entities.
 *
 * Evaluates precision in entity targeting when processing update/delete commands
 * (e.g., "Cancel Netflix" should modify Netflix, not Internet or other subscriptions).
 *
 * Supports ConversationStep and DatasetItem with metadata containing target and
 * modified entity information.
 */

import type {
  ConversationStep,
  DatasetItem,
  NumericAggregatorDef,
  SingleTurnContainer,
  SingleTurnMetricDef,
  SingleTargetFor,
} from '@tally/core/types';
import type { ModelMessage } from 'ai';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { type ExtractedToolCall, extractToolCalls } from '../common/utils';

/**
 * Entity reference
 */
export interface EntityReference {
  id: string;
  name: string;
  type?: string;
}

/**
 * State change record
 */
export interface StateChange {
  before: EntityReference & Record<string, unknown>;
  after: EntityReference & Record<string, unknown>;
}

/**
 * Metadata structure for target entity precision evaluation
 */
export interface TargetEntityPrecisionMetadata {
  /**
   * Target entity that should be modified (ground truth)
   */
  targetEntity: EntityReference;
  /**
   * Entity that was actually modified
   */
  modifiedEntity?: EntityReference;
  /**
   * State changes that occurred
   */
  stateChanges?: StateChange[];
  /**
   * Other entities that should NOT be modified
   */
  otherEntities?: EntityReference[];
  /**
   * Tool calls made (alternative to stateChanges)
   */
  toolCalls?: ExtractedToolCall[];
}

export interface TargetEntityPrecisionOptions {
  /**
   * Tool names that indicate entity updates
   * @default All tools with 'update', 'delete', 'modify', 'cancel' in name
   */
  updateToolNames?: string[];
  /**
   * Allow partial name matches (e.g., "Netflix" matches "Netflix Premium")
   * @default true
   */
  allowPartialMatch?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create a target entity precision metric
 *
 * Measures whether updates affect the correct target entity.
 * Verifies that the modified entity matches the intended target.
 *
 * Scoring:
 * - 1.0: Correct entity targeted, no unintended modifications
 * - 0.5: Partially correct (right type but wrong instance, or side effects)
 * - 0.0: Wrong entity targeted or multiple unintended modifications
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for target entity precision
 */
export function createTargetEntityPrecisionMetric<
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(options: TargetEntityPrecisionOptions = {}): SingleTurnMetricDef<number, TContainer> {
  const { updateToolNames, allowPartialMatch = true, aggregators } = options;

  const base = defineBaseMetric({
    name: 'targetEntityPrecision',
    valueType: 'number',
    description:
      'Measures whether update operations affect the correct target entity without unintended side effects',
    metadata: {
      updateToolNames,
      allowPartialMatch,
    },
  });

  const metric = defineSingleTurnCode<number, TContainer>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    preProcessor: async (selected: SingleTargetFor<TContainer>) => {
      // Extract tool calls if present
      let toolCalls: ExtractedToolCall[] = [];

      if ('completion' in selected) {
        // DatasetItem
        const item = selected as DatasetItem;
        if (
          typeof item.completion === 'object' &&
          item.completion !== null &&
          'role' in item.completion
        ) {
          const outputMessage = item.completion as ModelMessage;
          toolCalls = extractToolCalls(outputMessage);
        }
      } else if ('output' in selected) {
        // ConversationStep
        const step = selected as ConversationStep;
        for (const msg of step.output) {
          if (msg.role === 'assistant') {
            toolCalls.push(...extractToolCalls(msg));
          }
        }
      }

      // Filter to update-related tools
      if (updateToolNames && updateToolNames.length > 0) {
        toolCalls = toolCalls.filter((tc) => updateToolNames.includes(tc.toolName));
      } else {
        // Default: tools with update/delete/modify/cancel keywords
        toolCalls = toolCalls.filter((tc) => {
          const name = tc.toolName.toLowerCase();
          return (
            name.includes('update') ||
            name.includes('delete') ||
            name.includes('modify') ||
            name.includes('cancel') ||
            name.includes('remove')
          );
        });
      }

      // Extract metadata
      let metadata: TargetEntityPrecisionMetadata | undefined;
      if ('metadata' in selected && selected.metadata) {
        metadata = selected.metadata as unknown as TargetEntityPrecisionMetadata;
      }

      const targetEntity = metadata?.targetEntity;
      const modifiedEntity = metadata?.modifiedEntity;
      const stateChanges = metadata?.stateChanges ?? [];
      const otherEntities = metadata?.otherEntities ?? [];
      const metadataToolCalls = metadata?.toolCalls ?? [];

      return {
        toolCalls: toolCalls.length > 0 ? toolCalls : metadataToolCalls,
        targetEntity,
        modifiedEntity,
        stateChanges,
        otherEntities,
        allowPartialMatch,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            toolCalls: ExtractedToolCall[];
            targetEntity?: EntityReference;
            modifiedEntity?: EntityReference;
            stateChanges: StateChange[];
            otherEntities: EntityReference[];
            allowPartialMatch: boolean;
          }
        | undefined;

      if (!payload || !payload.targetEntity) {
        return 0;
      }

      const {
        toolCalls,
        targetEntity,
        modifiedEntity,
        stateChanges,
        otherEntities,
        allowPartialMatch: partialMatch,
      } = payload;

      // Determine modified entity from tool calls or metadata
      let actualModifiedEntity: EntityReference | undefined = modifiedEntity;

      if (!actualModifiedEntity && toolCalls.length > 0) {
        // Extract from tool call args
        const firstUpdateCall = toolCalls[0];
        if (!firstUpdateCall) {
          return 0;
        }
        const args = firstUpdateCall.args as Record<string, unknown>;

        const entityType = args.type ? String(args.type) : undefined;
        actualModifiedEntity = {
          id: String(args.id ?? args.entityId ?? ''),
          name: String(args.name ?? ''),
          ...(entityType ? { type: entityType } : {}),
        };
      }

      if (!actualModifiedEntity && stateChanges.length > 0) {
        // Extract from state changes
        const firstChange = stateChanges[0];
        if (!firstChange) {
          return 0;
        }
        actualModifiedEntity = {
          id: firstChange.after.id,
          name: firstChange.after.name,
          ...(firstChange.after.type && { type: firstChange.after.type }),
        };
      }

      if (!actualModifiedEntity) {
        return 0; // No modification detected
      }

      // Check if modified entity matches target entity
      const isCorrectEntity = entitiesMatch(targetEntity, actualModifiedEntity, partialMatch);

      if (!isCorrectEntity) {
        return 0; // Wrong entity targeted
      }

      // Check if any other entities were incorrectly modified
      const unintendedModifications = checkUnintendedModifications(
        stateChanges,
        targetEntity,
        otherEntities
      );

      if (unintendedModifications > 0) {
        // Penalize for side effects
        const penalty = Math.min(0.5, unintendedModifications * 0.2);
        return Math.max(0, 1 - penalty);
      }

      return 1.0; // Perfect precision
    },
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, TContainer>;
}

/**
 * Check if two entities match
 */
function entitiesMatch(
  entity1: EntityReference,
  entity2: EntityReference,
  allowPartial: boolean
): boolean {
  // ID match (most precise)
  if (entity1.id && entity2.id && entity1.id === entity2.id) {
    return true;
  }

  // Name match
  if (entity1.name && entity2.name) {
    if (entity1.name === entity2.name) {
      return true;
    }

    if (allowPartial) {
      const name1 = entity1.name.toLowerCase();
      const name2 = entity2.name.toLowerCase();
      return name1.includes(name2) || name2.includes(name1);
    }
  }

  return false;
}

/**
 * Check for unintended modifications to other entities
 */
function checkUnintendedModifications(
  stateChanges: StateChange[],
  targetEntity: EntityReference,
  otherEntities: EntityReference[]
): number {
  let count = 0;

  for (const change of stateChanges) {
    const changedEntityId = change.after.id;

    // Check if this change affects target entity (expected)
    if (changedEntityId === targetEntity.id) {
      continue; // Expected change
    }

    // Check if this affects one of the other entities (unintended)
    for (const other of otherEntities) {
      if (changedEntityId === other.id) {
        count++;
        break;
      }
    }
  }

  return count;
}
