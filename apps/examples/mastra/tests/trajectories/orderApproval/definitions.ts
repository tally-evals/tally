/**
 * Trajectory definitions for the Mastra Order Processing HIL example.
 *
 * Two trajectories:
 * - `orderApproveTrajectory` — HIL auto-approves the processOrder tool
 * - `orderRejectTrajectory`  — HIL auto-rejects the processOrder tool
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

const userModel = google('models/gemini-2.5-flash-lite');

// ============================================================================
// Approval trajectory
// ============================================================================

export const orderApproveTrajectory: Omit<Trajectory, 'agent'> = {
	goal: 'Search for wireless headphones and place an order',
	persona: {
		description:
			'You are Alex, a customer who wants to buy wireless headphones. Provide your details when asked: name "Alex Rivera", shipping address "42 Elm St, Austin TX 78701", quantity 1.',
	},
	steps: {
		steps: [
			{
				id: 'search',
				instruction: 'Ask the agent to search for wireless headphones',
			},
			{
				id: 'order',
				instruction:
					'Select the first available product and ask the agent to place the order',
				preconditions: [{ type: 'stepSatisfied', stepId: 'search' }],
			},
			{
				id: 'confirm',
				instruction:
					'Verify the agent confirms the order was placed successfully',
				preconditions: [{ type: 'stepSatisfied', stepId: 'order' }],
			},
		],
		start: 'search',
		terminals: ['confirm'],
	},
	maxTurns: 12,
	userModel,
	hil: {
		tools: {
			processOrder: {
				behavior: 'approve',
				approveResult: {
					orderId: 'ORD-TEST-001',
					productId: 'PROD-001',
					quantity: 1,
					total: 79.99,
					currency: 'USD',
					status: 'confirmed',
					estimatedDelivery: '3-5 business days',
				},
			},
		},
		defaultPolicy: 'approve',
	},
};

// ============================================================================
// Rejection trajectory
// ============================================================================

export const orderRejectTrajectory: Omit<Trajectory, 'agent'> = {
	goal: 'Attempt to order wireless headphones but have the order rejected',
	persona: {
		description:
			'You are Jordan, a customer browsing wireless headphones. Provide details when asked: name "Jordan Lee", shipping address "99 Pine Rd, Denver CO 80203", quantity 2.',
	},
	steps: {
		steps: [
			{
				id: 'search',
				instruction: 'Ask the agent to search for wireless headphones',
			},
			{
				id: 'order-attempt',
				instruction:
					'Select a product and ask the agent to place the order',
				preconditions: [{ type: 'stepSatisfied', stepId: 'search' }],
			},
			{
				id: 'handle-rejection',
				instruction:
					'Acknowledge the rejection or ask why the order was declined',
				preconditions: [
					{ type: 'stepSatisfied', stepId: 'order-attempt' },
				],
			},
		],
		start: 'search',
		terminals: ['handle-rejection'],
	},
	maxTurns: 12,
	userModel,
	hil: {
		tools: {
			processOrder: {
				behavior: 'reject',
				rejectReason:
					'Order declined: shipping address could not be verified. Please update your address and try again.',
			},
			searchProducts: {
				behavior: 'approve',
			},
		},
		defaultPolicy: 'approve',
	},
};
