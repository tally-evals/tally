/**
 * Convert StepTrace[] to Conversation
 *
 * Transforms trajectory execution traces into a Conversation format
 * that can be used for evaluation.
 */

import type { Conversation, ConversationStep, StepTrace } from '../types';

/**
 * Options for converting step traces to conversation
 */
export interface StepTracesToConversationOptions {
  /** Metadata to attach to the conversation */
  metadata?: Record<string, unknown>;
}

/**
 * Convert an array of StepTrace to a Conversation
 *
 * Maps trajectory execution traces to the unified Conversation format:
 * - turnIndex → stepIndex
 * - userMessage → input
 * - agentMessages → output
 *
 * @param traces - Array of step traces from trajectory execution
 * @param conversationId - ID for the resulting conversation
 * @param options - Additional options
 * @returns Conversation object
 */
export function stepTracesToConversation(
  traces: readonly StepTrace[],
  conversationId: string,
  options: StepTracesToConversationOptions = {}
): Conversation {
  const steps: ConversationStep[] = traces.map((trace, index) => ({
    stepIndex: index,
    input: trace.userMessage,
    output: [...trace.agentMessages],
    timestamp: trace.timestamp,
    metadata: {
      originalTurnIndex: trace.turnIndex,
      stepId: trace.stepId,
      selection: trace.selection,
      ...(trace.end !== undefined && { end: trace.end }),
    },
  }));

  return options.metadata
    ? { id: conversationId, steps, metadata: options.metadata }
    : { id: conversationId, steps };
}
