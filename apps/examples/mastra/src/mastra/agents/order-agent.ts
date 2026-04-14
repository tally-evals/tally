/**
 * Order Processing Agent (Mastra HIL Example)
 *
 * Demonstrates Human-in-the-Loop (HIL) with Mastra.
 *
 * The `processOrder` tool has `requireApproval: true`, so whenever the agent
 * decides to place an order, execution suspends and the trajectory
 * orchestrator resolves the pending approval before the tool executes.
 */

import { Agent } from '@mastra/core/agent';
import { searchProductsTool, processOrderTool } from '../tools/order-tools';

const DEFAULT_MODEL_ID = 'google/gemini-2.5-flash-lite';
const DEFAULT_MAX_STEPS = 10;

const SYSTEM_PROMPT = `You are a helpful order processing assistant. Your job is to:

1. Help the user find products by using the searchProducts tool.
2. Present the product options clearly, including name, price, and availability.
3. When the user selects a product or asks you to place an order, use the processOrder tool.
4. Confirm order details (customer name, shipping address, quantity) before attempting to order.
5. If the user provides all required details, proceed directly with the processOrder tool call.
6. After an order is confirmed or rejected, summarise what happened.

Important rules:
- Always search before ordering so the user can see options.
- Ask for customer name, shipping address, and quantity before calling processOrder.
- Be concise and friendly.
- Do NOT invent order IDs or confirmations — rely solely on tool results.`;

export const orderAgent = new Agent({
	id: 'order-agent',
	name: 'Order Processing Agent',
	instructions: SYSTEM_PROMPT,
	model: DEFAULT_MODEL_ID,
	tools: {
		searchProducts: searchProductsTool,
		processOrder: processOrderTool,
	},
	defaultGenerateOptions: {
		maxSteps: DEFAULT_MAX_STEPS,
	},
});
