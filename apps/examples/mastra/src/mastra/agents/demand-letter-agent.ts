import { Agent } from '@mastra/core/agent';
import { getTemplateFieldsTool } from '../tools/demand-letter/get-template-fields';
import { validateInputsTool } from '../tools/demand-letter/validate-inputs';
import { renderPreviewTool } from '../tools/demand-letter/render-preview';

const DEFAULT_MODEL_ID = 'google/gemini-2.5-flash-lite';
const DEFAULT_MAX_STEPS = 20;

const DEMAND_LETTER_SYSTEM_PROMPT = `You are a helpful legal assistant that helps users create demand letters. Your goal is to guide users through collecting all necessary information to create a proper demand letter.

1. Start by explaining what information is needed for a demand letter
2. Use the getTemplateFields tool to show users what fields are required
3. Ask for information one field at a time, being clear about what you need
4. Use the validateInputs tool to ensure information is correct before proceeding
5. Once all required information is collected, use the renderPreview tool to show the user a preview
6. Be professional, clear, and helpful throughout the process

Always ensure all required fields are collected before generating the final demand letter.`;

export const demandLetterAgent = new Agent({
  name: 'Demand Letter Agent',
  instructions: DEMAND_LETTER_SYSTEM_PROMPT,
  model: DEFAULT_MODEL_ID,
  tools: {
    getTemplateFields: getTemplateFieldsTool,
    validateInputs: validateInputsTool,
    renderPreview: renderPreviewTool,
  },
  defaultGenerateOptions: {
    maxSteps: DEFAULT_MAX_STEPS,
  },
});
