/**
 * Conversation Codec
 *
 * Zod-based codec for serializing/deserializing Conversation to/from JSONL format.
 */

import { z } from 'zod';
import type { Conversation, ConversationStep, ModelMessage } from '../types';

// Schema for ModelMessage (loose validation - trust AI SDK format)
const ModelMessageSchema = z.custom<ModelMessage>((val) => typeof val === 'object' && val !== null);

// Schema for ConversationStep
const ConversationStepSchema = z
  .object({
    stepIndex: z.number(),
    input: ModelMessageSchema,
    output: z.array(ModelMessageSchema),
    id: z.string().optional(),
    timestamp: z.date().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

// Schema for Conversation
const ConversationSchema = z.object({
  id: z.string(),
  steps: z.array(ConversationStepSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Export schemas for external use
export { ConversationSchema, ConversationStepSchema, ModelMessageSchema };

/**
 * Validate a Conversation object
 */
export function validateConversation(conversation: unknown): {
  success: boolean;
  data?: Conversation;
  error?: z.ZodError;
} {
  const result = ConversationSchema.safeParse(conversation);
  if (result.success) {
    return { success: true, data: result.data as Conversation };
  }
  return { success: false, error: result.error };
}

/**
 * Decode JSONL content to Conversation
 */
export function decodeConversation(content: string): Conversation {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Conversation file is empty');
  }

  const steps: ConversationStep[] = [];
  let conversationId = 'unknown';
  let conversationMetadata: Record<string, unknown> | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    try {
      const parsed = JSON.parse(line);

      // First line may contain conversationId and metadata
      if (i === 0) {
        if (typeof parsed.conversationId === 'string') {
          conversationId = parsed.conversationId;
        }
        if (parsed.conversationMetadata && typeof parsed.conversationMetadata === 'object') {
          conversationMetadata = parsed.conversationMetadata;
        }
      }

      // Parse timestamp
      let timestamp: Date | undefined;
      if (typeof parsed.timestamp === 'string') {
        timestamp = new Date(parsed.timestamp);
      } else if (parsed.timestamp instanceof Date) {
        timestamp = parsed.timestamp;
      }

      const step = {
        ...parsed,
        timestamp,
      };

      const result = ConversationStepSchema.safeParse(step);
      if (!result.success) {
        console.warn(`Line ${i + 1}: Invalid step format, skipping: ${result.error.message}`);
        continue;
      }

      steps.push(result.data as ConversationStep);
    } catch (err) {
      throw new Error(`Invalid JSON at line ${i + 1}: ${(err as Error).message}`);
    }
  }

  const conversation: Conversation = conversationMetadata
    ? { id: conversationId, steps, metadata: conversationMetadata }
    : { id: conversationId, steps };

  // Validate the final conversation
  const validationResult = ConversationSchema.safeParse(conversation);
  if (!validationResult.success) {
    throw new Error(`Invalid conversation structure: ${validationResult.error.message}`);
  }

  return conversation;
}

/**
 * Encode Conversation to JSONL content
 */
export function encodeConversation(conversation: Conversation): string {
  // Validate before encoding
  const validationResult = ConversationSchema.safeParse(conversation);
  if (!validationResult.success) {
    throw new Error(`Invalid conversation: ${validationResult.error.message}`);
  }

  return conversation.steps
    .map((step, index) => {
      const line: Record<string, unknown> = {
        ...step,
        conversationId: conversation.id,
      };

      // Include conversation metadata on first line
      if (index === 0 && conversation.metadata) {
        line.conversationMetadata = conversation.metadata;
      }

      return JSON.stringify(line);
    })
    .join('\n');
}

/**
 * Conversation codec with safe decode/encode methods
 */
export const ConversationCodec = {
  /**
   * Safely decode JSONL to Conversation
   */
  safeDecode(
    content: string
  ): { success: true; data: Conversation } | { success: false; error: Error } {
    try {
      const data = decodeConversation(content);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  },

  /**
   * Safely encode Conversation to JSONL
   */
  safeEncode(
    conversation: Conversation
  ): { success: true; data: string } | { success: false; error: Error } {
    try {
      const data = encodeConversation(conversation);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  },

  /**
   * Decode JSONL to Conversation (throws on error)
   */
  decode: decodeConversation,

  /**
   * Encode Conversation to JSONL (throws on error)
   */
  encode: encodeConversation,

  /**
   * Validate a Conversation object
   */
  validate: validateConversation,

  /**
   * The underlying Zod schema
   */
  schema: ConversationSchema,
};
