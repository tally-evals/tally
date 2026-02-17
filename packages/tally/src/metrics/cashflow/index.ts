/**
 * Cashflow Copilot Metrics
 *
 * Specialized metrics for evaluating cashflow management copilot systems.
 * Includes metrics for entity extraction, normalization, ambiguity handling,
 * cashflow correctness, affordability analysis, what-if scenarios, and entity updates.
 */

// Entity Extraction & Normalization
export {
  createEntityExtractionMetric,
  type EntityExtractionOptions,
  type EntityExtractionMetadata,
  type ExpectedEntity,
} from './entityExtraction';

export {
  createAmountNormalizationMetric,
  type AmountNormalizationOptions,
  type AmountNormalizationMetadata,
} from './amountNormalization';

export {
  createScheduleParsingMetric,
  type ScheduleParsingOptions,
  type ScheduleParsingMetadata,
} from './scheduleParsing';

export {
  createDateParsingMetric,
  type DateParsingOptions,
  type DateParsingMetadata,
} from './dateParsing';

// Ambiguity Handling
export {
  createClarificationPrecisionMetric,
  type ClarificationPrecisionOptions,
  type ClarificationPrecisionMetadata,
} from './clarificationPrecision';

export {
  createOverClarificationMetric,
  type OverClarificationOptions,
  type OverClarificationMetadata,
} from './overClarification';

// Cashflow Correctness
export {
  createCashflowCalculationMetric,
  type CashflowCalculationOptions,
  type CashflowCalculationMetadata,
  type CashflowEntry,
} from './cashflowCalculation';

export {
  createEventTimingMetric,
  type EventTimingOptions,
  type EventTimingMetadata,
  type EventOccurrence,
  type ExpectedEventDates,
} from './eventTiming';

// Affordability Analysis
export {
  createAffordabilityDecisionMetric,
  type AffordabilityDecisionOptions,
  type AffordabilityDecisionMetadata,
  type AffordabilityDecision,
} from './affordabilityDecision';

export {
  createBufferConsiderationMetric,
  type BufferConsiderationOptions,
  type BufferConsiderationMetadata,
} from './bufferConsideration';

// What-If Scenarios
export {
  createDeltaIsolationMetric,
  type DeltaIsolationOptions,
  type DeltaIsolationMetadata,
  type EntityState,
  type EntityChange,
} from './deltaIsolation';

export {
  createImpactReportingMetric,
  type ImpactReportingOptions,
  type ImpactReportingMetadata,
  type ImpactAnalysis,
} from './impactReporting';

// Entity Updates
export {
  createTargetEntityPrecisionMetric,
  type TargetEntityPrecisionOptions,
  type TargetEntityPrecisionMetadata,
  type EntityReference,
  type StateChange,
} from './targetEntityPrecision';

export {
  createUpdateAttributeCorrectnessMetric,
  type UpdateAttributeCorrectnessOptions,
  type UpdateAttributeCorrectnessMetadata,
  type ExpectedFieldChange,
  type EntityStateChange,
} from './updateAttributeCorrectness';
