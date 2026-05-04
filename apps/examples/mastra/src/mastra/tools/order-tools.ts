/**
 * Order processing tools (Mastra HIL Example)
 *
 * `processOrder` has `requireApproval: true`, so whenever the agent decides
 * to process an order the Mastra runtime suspends execution and emits a
 * `suspendPayload` — the trajectory orchestrator resolves the pending
 * approval according to the trajectory's `hil` configuration.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';

// ============================================================================
// searchProducts — no approval required
// ============================================================================

export const searchProductsTool = createTool({
	id: 'searchProducts',
	description:
		'Search the product catalogue by query. Returns matching products with price and availability.',
	inputSchema: z.object({
		query: z.string().describe('Free-text search term (e.g. "wireless headphones")'),
	}),
	outputSchema: z.object({
		products: z.array(
			z.object({
				productId: z.string(),
				name: z.string(),
				price: z.number(),
				currency: z.string(),
				inStock: z.boolean(),
			}),
		),
	}),
	execute: async (inputData) => {
		// Fake product catalogue
		const q = (inputData.query ?? '').toLowerCase();
		return {
			products: [
				{
					productId: 'PROD-001',
					name: 'Wireless Headphones Pro',
					price: 79.99,
					currency: 'USD',
					inStock: true,
				},
				{
					productId: 'PROD-002',
					name: 'Bluetooth Speaker Mini',
					price: 34.99,
					currency: 'USD',
					inStock: q.includes('speaker'),
				},
				{
					productId: 'PROD-003',
					name: 'USB-C Charging Cable (2-pack)',
					price: 12.99,
					currency: 'USD',
					inStock: true,
				},
			].filter(
				(p) =>
					p.name.toLowerCase().includes(q) ||
					q.includes(p.name.toLowerCase().split(' ')[0]!),
			),
		};
	},
});

// ============================================================================
// processOrder — requires human approval ⭐
// ============================================================================

export const processOrderTool = createTool({
	id: 'processOrder',
	description:
		'Place an order for a product. **Requires human approval** before the charge is processed. Call this when the user has confirmed they want to purchase.',
	inputSchema: z.object({
		productId: z.string().describe('Product ID from search results'),
		quantity: z.number().int().min(1).describe('Number of units to order'),
		customerName: z.string().describe('Full name of the customer'),
		shippingAddress: z.string().describe('Delivery address'),
	}),
	outputSchema: z.object({
		orderId: z.string(),
		productId: z.string(),
		quantity: z.number(),
		total: z.number(),
		currency: z.string(),
		status: z.string(),
		estimatedDelivery: z.string(),
	}),
	// ⭐ Mastra's per-tool HIL flag — agent suspends before executing
	requireApproval: true,
	execute: async (inputData) => ({
		orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
		productId: inputData.productId,
		quantity: inputData.quantity,
		total: 79.99 * inputData.quantity,
		currency: 'USD',
		status: 'confirmed',
		estimatedDelivery: '3-5 business days',
	}),
});
