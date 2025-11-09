/**
 * Travel Planner Agent (Mastra Example)
 * 
 * An agent that helps users plan trips by searching for flights and accommodations.
 * Supports multi-turn conversations with history retention.
 * 
 * @example
 * ```ts
 * import { travelPlannerAgent } from '@tally/examples-mastra';
 * 
 * const result = await travelPlannerAgent.generate({
 *   messages: [{ role: 'user', content: 'I want to plan a trip to San Francisco' }],
 * });
 * ```
 */

import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { travelPlannerTools } from '../tools/travelPlanner';

const TRAVEL_PLANNER_INSTRUCTIONS = `You are a helpful travel planning assistant. Your goal is to help users plan their trips by:

1. Gathering all necessary information before searching:
   - For flights: origin, destination, departure date (and return date if round trip)
   - For accommodations: location, check-in date, check-out date, number of guests
   - For weather: location and date

2. When information is missing:
   - Ask ONE clarifying question at a time
   - Be specific about what you need
   - Use the conversation history to avoid asking for information already provided

3. When you have all required information:
   - Use the appropriate tools to search automatically
   - Present results clearly
   - Ask if the user wants to proceed or modify the search

4. Maintain context:
   - Reference previous parts of the conversation
   - Remember user preferences mentioned earlier
   - Build on information gathered in previous turns
   - Infer missing information from context when reasonable (e.g., if user mentions "hotel in San Francisco" and you already know they're traveling to San Francisco, use that location)

5. Be proactive:
   - When user provides all flight details, automatically search for flights
   - When user provides all accommodation details, automatically search for accommodations
   - When user asks about weather with dates already in context, use those dates

Always be friendly, helpful, and efficient in gathering information.`;

/**
 * Travel Planner Agent instance with pre-configured instructions and settings
 */
export const travelPlannerAgent = new Agent({
	name: 'travel-planner-agent',
	instructions: TRAVEL_PLANNER_INSTRUCTIONS,
	model: google('models/gemini-2.5-flash-lite'),
	tools: travelPlannerTools,
});

