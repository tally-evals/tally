import { ModelMessage } from 'ai';
import { ZodIssueCode } from 'zod/v3';
import z from 'zod/v4';

const ModelMessageSchema = z.custom<ModelMessage>((val) => {
  return typeof val === 'object' && val !== null;
});

const ConversationStepSchema = z
  .object({
    stepIndex: z.number(),
    input: ModelMessageSchema,
    output: z.array(ModelMessageSchema),
    id: z.string().optional(),
    timestamp: z.date().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();

const ConversationSchema = z.object({
  id: z.string(),
  steps: z.array(ConversationStepSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ConversationCodec = z.codec(z.string(), ConversationSchema, {
  decode: (content, ctx) => {
    const lines = content.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      ctx.issues.push({
        code: ZodIssueCode.custom,
        message: 'Conversation file is empty',
        input: content,
      });
      return z.NEVER;
    }

    const steps: z.infer<typeof ConversationStepSchema>[] = [];
    let conversationId = 'unknown';

    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i];
        const parsed = JSON.parse(line as string);

        if (i === 0 && typeof parsed.conversationId === 'string') {
          conversationId = parsed.conversationId;
        }

        let timestamp: Date | undefined;
        if (typeof parsed.timestamp === 'string') {
          timestamp = new Date(parsed.timestamp);
        } else {
          timestamp = new Date();
        }

        const step = {
          ...parsed,
          timestamp,
        };

        const result = ConversationStepSchema.safeParse(step);
        if (!result.success) {
          result.error.issues.forEach((issue) =>
            ctx.issues.push({
              ...issue,
              path: [i, ...issue.path],
              message: `Line ${i + 1}: ${issue.message}`,
              input: step,
            }),
          );
          continue;
        }

        steps.push(result.data);
      } catch (err) {
        ctx.issues.push({
          code: ZodIssueCode.custom,
          message: `Invalid JSON at line ${i + 1}: ${(err as Error).message}`,
          path: [i],
          input: lines[i] as string,
        });
      }
    }

    return {
      id: conversationId,
      steps,
    };
  },

  encode: (conversation) =>
    conversation.steps
      .map((step) =>
        JSON.stringify({ ...step, conversationId: conversation.id }),
      )
      .join('\n'),
});
