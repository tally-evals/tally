import { createTool } from '@mastra/core/tools';
import { getTemplateFieldsParamsSchema } from '~/schemas/demand-letter';
import { DEMAND_LETTER_FIELDS } from './constants';

export const getTemplateFieldsTool = createTool({
  id: 'getTemplateFields',
  description: 'Get the list of required fields for creating a demand letter',
  inputSchema: getTemplateFieldsParamsSchema,
  execute: async () => {
    // We could filter by demandType from context.demandType if needed, 
    // but the original implementation just returned all fields regardless of input.
    // The input schema mentions optional demandType.
    
    return {
      fields: DEMAND_LETTER_FIELDS,
      message: `Found ${DEMAND_LETTER_FIELDS.length} required fields for demand letter creation`,
    };
  },
});
