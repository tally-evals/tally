import { createTool } from '@mastra/core/tools';
import { validateInputsParamsSchema } from '~/schemas/demand-letter';
import { DEMAND_LETTER_FIELDS } from './constants';

export const validateInputsTool = createTool({
  id: 'validateInputs',
  description: 'Validate user inputs against the template field requirements',
  inputSchema: validateInputsParamsSchema,
  execute: async ({ context }) => {
    const { fieldId, value } = context;

    const field = DEMAND_LETTER_FIELDS.find((f) => f.id === fieldId);
    if (!field) {
      return {
        valid: false,
        errors: [`Field ${fieldId} not found`],
        message: `Field ${fieldId} does not exist in the template`,
      };
    }

    let valueToCheck = value;
    if (field.type === 'number' && typeof value === 'string') {
      const cleanValue = value.replace(/[^0-9.-]+/g, '');
      const parsed = Number(cleanValue);
      if (!isNaN(parsed) && cleanValue !== '') {
        valueToCheck = parsed;
      }
    }

    const errors: string[] = [];
    if (field.required && (valueToCheck === null || valueToCheck === undefined || valueToCheck === '')) {
      errors.push(`${field.label} is required`);
    }
    if (field.type === 'number' && typeof valueToCheck !== 'number') {
      errors.push(`${field.label} must be a number`);
    }
    if (field.type === 'number' && typeof valueToCheck === 'number' && field.validation) {
      if (field.validation.min !== undefined && valueToCheck < field.validation.min) {
        errors.push(`${field.label} must be at least ${field.validation.min}`);
      }
      if (field.validation.max !== undefined && valueToCheck > field.validation.max) {
        errors.push(`${field.label} must be at most ${field.validation.max}`);
      }
    }
    if (field.type === 'select' && field.options && typeof valueToCheck === 'string') {
      if (!field.options.includes(valueToCheck)) {
        errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0 ? `${field.label} is valid` : `Validation failed: ${errors.join(', ')}`,
    };
  },
});
