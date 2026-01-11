/**
 * Convert Conversation to StepTrace[]
 *
 * Transforms a Conversation back into StepTrace format
 * for trajectory-style processing.
 */

import type { Conversation, ConversationStep, StepTrace } from '../types';

/**
 * Options for converting conversation to step traces
 */
export interface ConversationToStepTracesOptions {
  /** Whether to preserve original turn indices from metadata */
  preserveTurnIndices?: boolean;
}

/**
 * Build a StepTrace object from step data, properly handling optional properties
 */
function buildStepTrace(
  turnIndex: number,
  userMessage: StepTrace['userMessage'],
  agentMessages: readonly StepTrace['agentMessages'][number][],
  timestamp: Date,
  stepId: StepTrace['stepId'],
  selection: StepTrace['selection'],
  end: StepTrace['end'] | undefined
): StepTrace {
  const base: StepTrace = {
    turnIndex,
    userMessage,
    agentMessages,
    timestamp,
    stepId,
    selection,
  };

  if (end !== undefined) base.end = end;

  return base;
}

/**
 * Convert a Conversation to an array of StepTrace
 *
 * Maps Conversation format back to trajectory traces:
 * - stepIndex → turnIndex
 * - input → userMessage
 * - output → agentMessages
 *
 * @param conversation - Conversation to convert
 * @param options - Additional options
 * @returns Array of StepTrace objects
 */
export function conversationToStepTraces(
  conversation: Conversation,
  options: ConversationToStepTracesOptions = {}
): StepTrace[] {
  const { preserveTurnIndices = false } = options;

  return conversation.steps.map((step, index) => {
    // Try to recover original turn index from metadata
    let turnIndex = index;
    if (
      preserveTurnIndices &&
      step.metadata &&
      typeof step.metadata.originalTurnIndex === 'number'
    ) {
      turnIndex = step.metadata.originalTurnIndex;
    }

    // Recover step ID from metadata. Null means "no step selected".
    let stepId: StepTrace['stepId'] = null;
    if (step.metadata && typeof step.metadata.stepId === 'string') {
      stepId = step.metadata.stepId;
    } else if (step.metadata && step.metadata.stepId === null) {
      stepId = null;
    }

    // Recover selection info (best-effort; default to "none")
    const selection: StepTrace['selection'] =
      step.metadata && typeof step.metadata.selection === 'object' && step.metadata.selection
        ? (step.metadata.selection as StepTrace['selection'])
        : { method: 'none' };

    // Recover end marker (optional)
    const end =
      step.metadata && typeof step.metadata.end === 'object' && step.metadata.end
        ? (step.metadata.end as StepTrace['end'])
        : undefined;

    return buildStepTrace(
      turnIndex,
      step.input,
      [...step.output],
      step.timestamp ?? new Date(),
      stepId,
      selection,
      end
    );
  });
}

/**
 * Convert a single ConversationStep to StepTrace
 *
 * @param step - The conversation step to convert
 * @param turnIndex - Optional override for turn index
 * @returns StepTrace object
 */
export function conversationStepToStepTrace(step: ConversationStep, turnIndex?: number): StepTrace {
  let stepId: StepTrace['stepId'] = null;
  if (step.metadata && typeof step.metadata.stepId === 'string') {
    stepId = step.metadata.stepId;
  } else if (step.metadata && step.metadata.stepId === null) {
    stepId = null;
  }

  const selection: StepTrace['selection'] =
    step.metadata && typeof step.metadata.selection === 'object' && step.metadata.selection
      ? (step.metadata.selection as StepTrace['selection'])
      : { method: 'none' };

  const end =
    step.metadata && typeof step.metadata.end === 'object' && step.metadata.end
      ? (step.metadata.end as StepTrace['end'])
      : undefined;

  return buildStepTrace(
    turnIndex ?? step.stepIndex,
    step.input,
    [...step.output],
    step.timestamp ?? new Date(),
    stepId,
    selection,
    end
  );
}
