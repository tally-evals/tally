import { createTool } from '@mastra/core/tools';
import { renderPreviewParamsSchema } from '~/schemas/demand-letter';

export const renderPreviewTool = createTool({
  id: 'renderPreview',
  description: 'Render a preview of the demand letter based on collected information',
  inputSchema: renderPreviewParamsSchema,
  execute: async ({ context }) => {
    // console.log('RENDER PREVIEW CONTEXT:', JSON.stringify(context, null, 2));
    
    const {
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      amount,
      dueDate,
      description,
      legalBasis,
      demandType,
    } = context;

    // Ensure amount is a number
    const amountNum = Number(amount);
    if (isNaN(amountNum)) {
        throw new Error(`Invalid amount: ${amount}`);
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const letter = `
DEMAND LETTER

Date: ${today}

FROM:
${senderName}
${senderAddress}

TO:
${recipientName}
${recipientAddress}

RE: Demand for ${demandType === 'payment' ? 'Payment' : 'Action'} - $${amountNum.toFixed(2)}

Dear ${recipientName},

This letter serves as a formal demand for ${demandType === 'payment' ? `payment of $${amountNum.toFixed(2)}` : 'action'} regarding ${description}.

The legal basis for this demand is: ${legalBasis}.

Failure to comply by ${dueDate} may result in further legal action to enforce my rights.

Sincerely,

${senderName}
`;

    return {
      preview: letter,
      message: 'Demand letter preview generated successfully',
    };
  },
});
