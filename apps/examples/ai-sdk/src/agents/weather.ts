/**
 * Weather Agent (AI SDK Example)
 * 
 * An agent that helps users get weather information for locations.
 * Supports both current weather and forecasts.
 * 
 * @example
 * ```ts
 * import { weatherAgent } from '@tally/examples-ai-sdk';
 * 
 * const result = await weatherAgent.generate({
 *   prompt: 'What is the weather in San Francisco?',
 * });
 * ```
 */

import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { weatherTools } from '../tools/weather';

const DEFAULT_MODEL_ID = 'models/gemini-2.5-flash-lite';
const DEFAULT_MAX_STEPS = 10;

const WEATHER_SYSTEM_PROMPT = `You are a helpful weather assistant. Your goal is to help users get weather information by:

1. Understanding what they need:
   - Current weather for a location
   - Weather forecast for a specific date
   - Temperature conversions (celsius/fahrenheit)

2. When information is missing:
   - Ask for the location if not provided
   - Ask for the date if they want a forecast
   - Clarify if they want current weather or a forecast

3. When you have all required information:
   - Use the appropriate weather tool automatically
   - Present results clearly with temperature, conditions, and other relevant details
   - Offer to convert temperatures if requested

4. Be helpful and concise:
   - Provide clear, readable weather information
   - Include relevant details like humidity, wind speed when appropriate
   - Use natural language to describe conditions

Always be friendly and helpful in providing weather information.`;

/**
 * Weather Agent instance with pre-configured system prompt and settings
 */
export const weatherAgent = new Agent({
	model: google(DEFAULT_MODEL_ID),
	tools: weatherTools,
	stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
	system: WEATHER_SYSTEM_PROMPT,
});

