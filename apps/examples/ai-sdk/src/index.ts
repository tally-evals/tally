/**
 * @tally/examples-ai-sdk
 * 
 * Example agents built with AI SDK for use with Tally evaluation framework.
 * 
 * @example
 * ```ts
 * import { travelPlannerAgent, demandLetterAgent } from '@tally-evals/examples-ai-sdk';
 * 
 * // Use travel planner agent
 * const result = await travelPlannerAgent.generate({
 *   prompt: 'I want to plan a trip to San Francisco',
 * });
 * 
 * // Use demand letter agent
 * const letterResult = await demandLetterAgent.generate({
 *   prompt: 'I need a demand letter',
 * });
 * ```
 */

// Export agent instances
export { travelPlannerAgent } from './agents/travelPlanner';
export { demandLetterAgent } from './agents/demandLetter';
export { weatherAgent } from './agents/weather';

// Export tools
export { travelPlannerTools } from './tools/travelPlanner';
export { demandLetterTools } from './tools/demandLetter';
export { weatherTools } from './tools/weather';

// Export types from tools
export type {
	Flight,
	Accommodation,
} from './tools/travelPlanner';

export type {
	WeatherData,
} from './tools/weather';

