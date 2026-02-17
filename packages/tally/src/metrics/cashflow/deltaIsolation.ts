/**
 * Delta Isolation Accuracy Metric
 *
 * A code-based single-turn metric that measures whether what-if scenario
 * modifications only affect the intended entities, without unintended side effects.
 *
 * Evaluates that only the specific changed items differ between baseline and
 * scenario states, ensuring precision in scenario analysis.
 *
 * Requires DatasetItem with metadata containing baseline, scenario, and expected changes.
 */

import type { DatasetItem, NumericAggregatorDef, SingleTurnMetricDef } from '@tally/core/types';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';

/**
 * Entity state (generic for any cashflow entity)
 */
export interface EntityState {
  id: string;
  [key: string]: unknown;
}

/**
 * Change description
 */
export interface EntityChange {
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Metadata structure for delta isolation evaluation
 */
export interface DeltaIsolationMetadata {
  /**
   * Baseline state (before scenario)
   */
  baselineState: {
    [entityType: string]: EntityState[];
  };
  /**
   * Scenario state (after what-if modification)
   */
  scenarioState: {
    [entityType: string]: EntityState[];
  };
  /**
   * Expected changes (only these should differ)
   */
  expectedChanges: EntityChange[];
  /**
   * Scenario query/description
   */
  scenarioQuery?: string;
}

export interface DeltaIsolationOptions {
  /**
   * Entity types to check (if not specified, checks all)
   */
  entityTypes?: string[];
  /**
   * Strict mode: any unexpected change results in 0 score
   * @default false
   */
  strictMode?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create a delta isolation accuracy metric
 *
 * Measures whether scenario changes only affect intended entities.
 * Compares baseline vs scenario states and validates that only expected
 * changes occurred.
 *
 * Scoring:
 * - 1.0: Only expected changes present, no unintended side effects
 * - Penalty: Applied for each unexpected change
 * - 0.0: Many unexpected changes or missing expected changes
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for delta isolation accuracy
 */
export function createDeltaIsolationMetric(
  options: DeltaIsolationOptions = {}
): SingleTurnMetricDef<number, DatasetItem> {
  const { entityTypes, strictMode = false, aggregators } = options;

  const base = defineBaseMetric({
    name: 'deltaIsolationAccuracy',
    valueType: 'number',
    description:
      'Measures whether what-if scenario changes only affect intended entities without side effects',
    metadata: {
      entityTypes,
      strictMode,
    },
  });

  const metric = defineSingleTurnCode<number, DatasetItem>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    preProcessor: async (selected: DatasetItem) => {
      const item = selected;

      // Extract delta isolation data from metadata
      const metadata = item.metadata as DeltaIsolationMetadata | undefined;

      const baselineState = metadata?.baselineState ?? {};
      const scenarioState = metadata?.scenarioState ?? {};
      const expectedChanges = metadata?.expectedChanges ?? [];

      return {
        baselineState,
        scenarioState,
        expectedChanges,
        entityTypes: entityTypes ?? Object.keys(baselineState),
        strictMode,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            baselineState: { [entityType: string]: EntityState[] };
            scenarioState: { [entityType: string]: EntityState[] };
            expectedChanges: EntityChange[];
            entityTypes: string[];
            strictMode: boolean;
          }
        | undefined;

      if (!payload) {
        return 0;
      }

      const {
        baselineState,
        scenarioState,
        expectedChanges,
        entityTypes: types,
        strictMode: strict,
      } = payload;

      if (expectedChanges.length === 0) {
        // If no changes expected, baseline and scenario should be identical
        const hasDifferences = checkForAnyDifferences(baselineState, scenarioState, types);
        return hasDifferences ? 0 : 1;
      }

      // Find all actual changes between baseline and scenario
      const actualChanges = findAllChanges(baselineState, scenarioState, types);

      // Match actual changes to expected changes
      const matchedExpected = new Set<number>();
      const matchedActual = new Set<number>();

      for (let i = 0; i < expectedChanges.length; i++) {
        const expected = expectedChanges[i];
        if (!expected) continue;

        for (let j = 0; j < actualChanges.length; j++) {
          if (matchedActual.has(j)) continue;

          const actual = actualChanges[j];
          if (!actual) continue;

          if (changesMatch(expected, actual)) {
            matchedExpected.add(i);
            matchedActual.add(j);
            break;
          }
        }
      }

      const expectedFound = matchedExpected.size;
      const unexpectedChanges = actualChanges.length - matchedActual.size;

      // Calculate score
      if (strict && unexpectedChanges > 0) {
        return 0; // Strict mode: any unexpected change is failure
      }

      if (expectedFound < expectedChanges.length) {
        // Missing expected changes
        const missingRatio = (expectedChanges.length - expectedFound) / expectedChanges.length;
        return Math.max(0, 1 - missingRatio * 0.7); // 70% penalty for missing changes
      }

      if (unexpectedChanges > 0) {
        // Unexpected changes present
        const unexpectedRatio = unexpectedChanges / (actualChanges.length || 1);
        return Math.max(0, 1 - unexpectedRatio * 0.5); // 50% penalty for unexpected changes
      }

      return 1.0; // Perfect isolation
    },
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}

/**
 * Check if two changes match
 */
function changesMatch(expected: EntityChange, actual: EntityChange): boolean {
  return (
    expected.entityId === actual.entityId &&
    expected.field === actual.field &&
    valuesEqual(expected.newValue, actual.newValue)
  );
}

/**
 * Check if two values are equal (handles objects and primitives)
 */
function valuesEqual(val1: unknown, val2: unknown): boolean {
  if (val1 === val2) return true;

  // Handle object comparison
  if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
    return JSON.stringify(val1) === JSON.stringify(val2);
  }

  return false;
}

/**
 * Find all changes between baseline and scenario states
 */
function findAllChanges(
  baseline: { [entityType: string]: EntityState[] },
  scenario: { [entityType: string]: EntityState[] },
  entityTypes: string[]
): EntityChange[] {
  const changes: EntityChange[] = [];

  for (const entityType of entityTypes) {
    const baselineEntities = baseline[entityType] ?? [];
    const scenarioEntities = scenario[entityType] ?? [];

    // Create maps by entity ID
    const baselineById = new Map<string, EntityState>();
    for (const entity of baselineEntities) {
      baselineById.set(entity.id, entity);
    }

    const scenarioById = new Map<string, EntityState>();
    for (const entity of scenarioEntities) {
      scenarioById.set(entity.id, entity);
    }

    // Check each scenario entity against baseline
    for (const [id, scenarioEntity] of scenarioById) {
      const baselineEntity = baselineById.get(id);

      if (!baselineEntity) {
        // New entity added
        changes.push({
          entityId: id,
          field: '_entity_added',
          oldValue: null,
          newValue: scenarioEntity,
        });
        continue;
      }

      // Compare fields
      for (const [field, newValue] of Object.entries(scenarioEntity)) {
        if (field === 'id') continue;

        const oldValue = baselineEntity[field];

        if (!valuesEqual(oldValue, newValue)) {
          changes.push({
            entityId: id,
            field,
            oldValue,
            newValue,
          });
        }
      }
    }

    // Check for removed entities
    for (const [id, baselineEntity] of baselineById) {
      if (!scenarioById.has(id)) {
        changes.push({
          entityId: id,
          field: '_entity_removed',
          oldValue: baselineEntity,
          newValue: null,
        });
      }
    }
  }

  return changes;
}

/**
 * Check if there are any differences between states
 */
function checkForAnyDifferences(
  baseline: { [entityType: string]: EntityState[] },
  scenario: { [entityType: string]: EntityState[] },
  entityTypes: string[]
): boolean {
  const changes = findAllChanges(baseline, scenario, entityTypes);
  return changes.length > 0;
}
