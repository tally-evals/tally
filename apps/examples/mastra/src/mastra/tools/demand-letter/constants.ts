import type { TemplateField } from '~/schemas/demand-letter';

export const DEMAND_LETTER_FIELDS: TemplateField[] = [
    { id: 'recipientName', name: 'recipientName', label: 'Recipient Name', type: 'text', required: true, description: 'Full legal name of the recipient' },
    { id: 'recipientAddress', name: 'recipientAddress', label: 'Recipient Address', type: 'textarea', required: true, description: 'Complete mailing address' },
    { id: 'senderName', name: 'senderName', label: 'Your Name', type: 'text', required: true, description: 'Your full legal name' },
    { id: 'senderAddress', name: 'senderAddress', label: 'Your Address', type: 'textarea', required: true, description: 'Your address' },
    { id: 'amount', name: 'amount', label: 'Amount Owed', type: 'number', required: true, description: 'Amount demanded (USD)', validation: { min: 0 } },
    { id: 'dueDate', name: 'dueDate', label: 'Due Date', type: 'date', required: true, description: 'Date by which the demand must be fulfilled' },
    { id: 'description', name: 'description', label: 'Description of Claim', type: 'textarea', required: true, description: 'Detailed description' },
    { id: 'legalBasis', name: 'legalBasis', label: 'Legal Basis', type: 'text', required: true, description: 'Legal basis for the demand' },
    { id: 'demandType', name: 'demandType', label: 'Type of Demand', type: 'select', required: true, description: 'Demand type', options: ['payment', 'action', 'cease-and-desist'] },
];
