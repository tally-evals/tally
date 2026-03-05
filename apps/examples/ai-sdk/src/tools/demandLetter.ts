/**
 * Demand Letter Tools (Example - AI SDK)
 */

import { tool } from 'ai';
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

export const demandLetterTools = {
	getTemplateFields: tool({
		description: 'Get the list of required fields for creating a demand letter',
		inputSchema: z.object({
			demandType: z.enum(['payment', 'action', 'cease-and-desist']).optional().describe('Filter fields by demand type'),
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
	}),

	validateInputs: tool({
		description: 'Validate user inputs against the template field requirements',
		inputSchema: z.object({
			fieldId: z.string().describe('The field ID to validate'),
			value: z.string().describe('The value to validate (use string representation for numbers)'),
		}),
		execute: async ({ fieldId, value: rawValue }) => {
			// Parse numeric values from string if needed
			const value = /^\d+(\.\d+)?$/.test(rawValue) ? Number(rawValue) : rawValue;
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

			const field = fields.find((f) => f.id === fieldId);
			if (!field) {
				return {
					valid: false,
					errors: [`Field ${fieldId} not found`],
					message: `Field ${fieldId} does not exist in the template`,
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
			if (field.type === 'select' && field.options && typeof value === 'string') {
				if (!field.options.includes(value)) {
					errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
				}
			}

			return {
				valid: errors.length === 0,
				errors: errors.length > 0 ? errors : undefined,
				message: errors.length === 0 ? `${field.label} is valid` : `Validation failed: ${errors.join(', ')}`,
			};
		},
	}),
};


