import { z } from 'zod';

export const demandTypeSchema = z.enum(['payment', 'action', 'cease-and-desist']);

export const templateFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  required: z.boolean(),
  description: z.string(),
  options: z.array(z.string()).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

export type TemplateField = z.infer<typeof templateFieldSchema>;

export const getTemplateFieldsParamsSchema = z.object({
  demandType: demandTypeSchema.optional().describe('Filter fields by demand type'),
});

export const validateInputsParamsSchema = z.object({
  fieldId: z.string().describe('The field ID to validate'),
  value: z.union([z.string(), z.number()]).describe('The value to validate'),
});

export const renderPreviewParamsSchema = z.object({
  recipientName: z.string(),
  recipientAddress: z.string(),
  senderName: z.string(),
  senderAddress: z.string(),
  amount: z.number(),
  dueDate: z.string(),
  description: z.string(),
  legalBasis: z.string(),
  demandType: demandTypeSchema,
});

export type GetTemplateFieldsParams = z.infer<typeof getTemplateFieldsParamsSchema>;
export type ValidateInputsParams = z.infer<typeof validateInputsParamsSchema>;
export type RenderPreviewParams = z.infer<typeof renderPreviewParamsSchema>;
