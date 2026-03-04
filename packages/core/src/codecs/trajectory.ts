/**
 * Trajectory codecs
 *
 * - TrajectoryMeta: JSON with Date fields (createdAt) preserved.
 * - StepTraces: JSON array with Date fields (timestamp) preserved.
 */

import { z } from 'zod';
import type { StepTrace, TrajectoryMeta } from '../types';

const DateStringSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Invalid date string',
});

const TrajectoryMetaSchema = z.object({
  version: z.literal(1),
  trajectoryId: z.string(),
  createdAt: z.union([z.date(), DateStringSchema]),
  goal: z.string(),
  persona: z.object({
    name: z.string().optional(),
    description: z.string(),
    guardrails: z.array(z.string()).optional(),
  }),
  maxTurns: z.number().optional(),
  loopDetection: z
    .object({
      maxConsecutiveSameStep: z.number().optional(),
      maxCycleLength: z.number().optional(),
      maxCycleRepetitions: z.number().optional(),
    })
    .optional(),
  stepGraph: z
    .object({
      start: z.string(),
      terminals: z.array(z.string()).optional(),
      steps: z.array(z.record(z.string(), z.unknown())),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// StepTrace schema: we trust ModelMessage shape (same approach as ConversationCodec)
const ModelMessageSchema = z.custom((val) => typeof val === 'object' && val !== null);

const StepSelectionSchema = z.object({
  method: z.enum(['start', 'preconditions-ordered', 'llm-ranked', 'none']),
  candidates: z
    .array(
      z.object({
        stepId: z.string(),
        score: z.number(),
        reasons: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

const StepTraceEndSchema = z.object({
  isFinal: z.literal(true),
  reason: z.enum(['goal-reached', 'max-turns', 'policy-violation', 'agent-loop', 'no-step-match', 'error']),
  completed: z.boolean(),
  summary: z.string().optional(),
});

const StepTraceSchema = z.object({
  turnIndex: z.number(),
  userMessage: ModelMessageSchema,
  agentMessages: z.array(ModelMessageSchema),
  timestamp: z.union([z.date(), DateStringSchema]),
  stepId: z.string().nullable(),
  selection: StepSelectionSchema,
  end: StepTraceEndSchema.optional(),
});

const StepTracesSchema = z.array(StepTraceSchema);

function reviveDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

export function encodeTrajectoryMeta(meta: TrajectoryMeta): string {
  const json = {
    ...meta,
    createdAt: meta.createdAt.toISOString(),
  };
  return JSON.stringify(json, null, 2);
}

export function decodeTrajectoryMeta(content: string): TrajectoryMeta {
  const parsed = JSON.parse(content) as unknown;
  const result = TrajectoryMetaSchema.parse(parsed);
  const createdAt = reviveDate(result.createdAt);
  if (!createdAt) throw new Error('Invalid createdAt in TrajectoryMeta');
  return {
    ...(result as Omit<TrajectoryMeta, 'createdAt'>),
    createdAt,
  } as TrajectoryMeta;
}

export function encodeStepTraces(traces: readonly StepTrace[]): string {
  const json = traces.map((t) => ({
    ...t,
    timestamp: t.timestamp.toISOString(),
  }));
  return JSON.stringify(json, null, 2);
}

export function decodeStepTraces(content: string): StepTrace[] {
  const parsed = JSON.parse(content) as unknown;
  const arr = StepTracesSchema.parse(parsed);
  return arr.map((t) => {
    const timestamp = reviveDate(t.timestamp);
    if (!timestamp) throw new Error('Invalid timestamp in StepTrace');
    return {
      ...(t as Omit<StepTrace, 'timestamp'>),
      timestamp,
    } as StepTrace;
  });
}

