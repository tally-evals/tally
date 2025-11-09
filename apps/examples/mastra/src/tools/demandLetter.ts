/**
 * Demand Letter Tools (Mastra Example)
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export interface TemplateField {
	id: string;
	name: string;
	label: string;
	type: 'text' | 'number' | 'date' | 'select' | 'textarea';
	required: boolean;
	description: string;
	options?: string[];
	validation?: {
		min?: number;
		max?: number;
		pattern?: string;
	};
}

export interface DemandLetterData {
	recipientName: string;
	recipientAddress: string;
	senderName: string;
	senderAddress: string;
	amount: number;
	dueDate: string;
	description: string;
	legalBasis: string;
	demandType: 'payment' | 'action' | 'cease-and-desist';
}

export const getTemplateFieldsTool = createTool({
	id: 'get-template-fields',
	description: 'Get the list of required fields for creating a demand letter',
	inputSchema: z.object({
		demandType: z.enum(['payment', 'action', 'cease-and-desist']).optional().describe('Filter fields by demand type'),
	}),
	outputSchema: z.object({
		fields: z.array(z.object({
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
		})),
		message: z.string(),
	}),
	execute: async () => {
		const fields: TemplateField[] = [
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

		return {
			fields,
			message: `Found ${fields.length} required fields for demand letter creation`,
		};
	},
});

export const validateInputsTool = createTool({
	id: 'validate-inputs',
	description: 'Validate user inputs against the template field requirements',
	inputSchema: z.object({
		fieldId: z.string().describe('The field ID to validate'),
		value: z.union([z.string(), z.number()]).describe('The value to validate'),
	}),
	outputSchema: z.object({
		valid: z.boolean(),
		message: z.string(),
		errors: z.array(z.string()).optional(),
	}),
	execute: async ({ context }) => {
		const { fieldId, value } = context;
		const fields: TemplateField[] = [
			{ id: 'recipientName', name: 'recipientName', label: 'Recipient Name', type: 'text', required: true, description: '' },
			{ id: 'recipientAddress', name: 'recipientAddress', label: 'Recipient Address', type: 'textarea', required: true, description: '' },
			{ id: 'senderName', name: 'senderName', label: 'Your Name', type: 'text', required: true, description: '' },
			{ id: 'senderAddress', name: 'senderAddress', label: 'Your Address', type: 'textarea', required: true, description: '' },
			{ id: 'amount', name: 'amount', label: 'Amount Owed', type: 'number', required: true, description: '', validation: { min: 0 } },
			{ id: 'dueDate', name: 'dueDate', label: 'Due Date', type: 'date', required: true, description: '' },
			{ id: 'description', name: 'description', label: 'Description of Claim', type: 'textarea', required: true, description: '' },
			{ id: 'legalBasis', name: 'legalBasis', label: 'Legal Basis', type: 'text', required: true, description: '' },
			{ id: 'demandType', name: 'demandType', label: 'Type of Demand', type: 'select', required: true, description: '', options: ['payment', 'action', 'cease-and-desist'] },
		];

		const field = fields.find(f => f.id === fieldId);
		if (!field) {
			return {
				valid: false,
				message: `Field '${fieldId}' not found`,
				errors: [`Unknown field: ${fieldId}`],
			};
		}

		const errors: string[] = [];

		if (field.required && (value === null || value === undefined || value === '')) {
			errors.push(`${field.label} is required`);
		}

		if (field.type === 'number' && typeof value !== 'number') {
			errors.push(`${field.label} must be a number`);
		}

		if (field.type === 'number' && typeof value === 'number' && field.validation) {
			if (field.validation.min !== undefined && value < field.validation.min) {
				errors.push(`${field.label} must be at least ${field.validation.min}`);
			}
			if (field.validation.max !== undefined && value > field.validation.max) {
				errors.push(`${field.label} must be at most ${field.validation.max}`);
			}
		}

		if (field.type === 'select' && field.options && typeof value === 'string' && !field.options.includes(value)) {
			errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
		}

		return {
			valid: errors.length === 0,
			message: errors.length === 0 ? `${field.label} is valid` : `Validation failed: ${errors.join(', ')}`,
			errors: errors.length > 0 ? errors : undefined,
		};
	},
});

export const renderPreviewTool = createTool({
	id: 'render-preview',
	description: 'Render a preview of the demand letter based on collected data',
	inputSchema: z.object({
		data: z.object({
			recipientName: z.string(),
			recipientAddress: z.string(),
			senderName: z.string(),
			senderAddress: z.string(),
			amount: z.number().optional(),
			dueDate: z.string(),
			description: z.string(),
			legalBasis: z.string(),
			demandType: z.enum(['payment', 'action', 'cease-and-desist']),
		}).describe('The collected demand letter data'),
	}),
	outputSchema: z.object({
		preview: z.string(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		const { data } = context;
		const preview = `
DEMAND LETTER

${data.senderName}
${data.senderAddress}

${new Date().toLocaleDateString()}

${data.recipientName}
${data.recipientAddress}

RE: ${data.demandType.toUpperCase()} DEMAND

Dear ${data.recipientName},

This letter serves as a formal demand regarding the following matter:

${data.description}

Legal Basis: ${data.legalBasis}

${data.amount ? `Amount Owed: $${data.amount.toFixed(2)}` : ''}

We demand that you ${data.demandType === 'payment' ? 'make payment' : data.demandType === 'action' ? 'take the following action' : 'cease and desist'} by ${data.dueDate}.

Please contact us to resolve this matter promptly.

Sincerely,
${data.senderName}
		`.trim();

		return {
			preview,
			message: 'Demand letter preview generated successfully',
		};
	},
});

export const demandLetterTools = {
	getTemplateFields: getTemplateFieldsTool,
	validateInputs: validateInputsTool,
	renderPreview: renderPreviewTool,
};

