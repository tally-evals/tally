/**
 * Zod schemas for configuration validation
 */

import { z } from 'zod';

const S2ConfigSchema = z.object({
  basin: z.string(),
  accessToken: z.string(),
});

const RedisConfigSchema = z.object({
  url: z.string(),
  keyPrefix: z.string().optional(),
  streamMaxLen: z.number().optional(),
});

const StorageConfigSchema = z.object({
  backend: z.enum(['local', 's2', 'redis']),
  path: z.string().optional(),
  autoCreate: z.boolean().optional(),
  s2: S2ConfigSchema.optional(),
  redis: RedisConfigSchema.optional(),
});

const DefaultsConfigSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxRetries: z.number().min(0).optional(),
});

const LoopDetectionSchema = z.object({
  maxConsecutiveSameStep: z.number().min(1).optional(),
});

const TrajectoriesConfigSchema = z.object({
  maxTurns: z.number().min(1).optional(),
  generateLogs: z.boolean().optional(),
  loopDetection: LoopDetectionSchema.optional(),
});

const EvaluationConfigSchema = z.object({
  parallelism: z.number().min(1).optional(),
  timeout: z.number().min(0).optional(),
});

export const TallyConfigInputSchema = z.object({
  storage: StorageConfigSchema.optional(),
  defaults: DefaultsConfigSchema.optional(),
  trajectories: TrajectoriesConfigSchema.optional(),
  evaluation: EvaluationConfigSchema.optional(),
});

/**
 * Validate configuration input
 */
export function validateConfig(input: unknown): {
  success: boolean;
  data?: z.infer<typeof TallyConfigInputSchema>;
  error?: z.ZodError;
} {
  const result = TallyConfigInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
