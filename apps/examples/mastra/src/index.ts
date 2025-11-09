/**
 * @tally/examples-mastra
 * 
 * Example agents built with Mastra for use with Tally evaluation framework.
 * 
 * @example
 * ```ts
 * import { travelPlannerAgent, demandLetterAgent } from '@tally/examples-mastra';
 * 
 * // Use travel planner agent
 * const result = await travelPlannerAgent.generate({
 *   messages: [{ role: 'user', content: 'I want to plan a trip to San Francisco' }],
 * });
 * 
 * // Use demand letter agent
 * const letterResult = await demandLetterAgent.generate({
 *   messages: [{ role: 'user', content: 'I need a demand letter' }],
 * });
 * ```
 */

// Export agent instances
export { travelPlannerAgent } from './agents/travelPlanner';
export { demandLetterAgent } from './agents/demandLetter';

// Export tools
export { travelPlannerTools } from './tools/travelPlanner';
export { demandLetterTools } from './tools/demandLetter';

// Export types from tools
export type {
	Flight,
	Accommodation,
} from './tools/travelPlanner';

export type {
	TemplateField,
	DemandLetterData,
} from './tools/demandLetter';
