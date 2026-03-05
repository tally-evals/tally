/**
 * Weather Tools (Example - AI SDK)
 */

import { tool } from 'ai';
import { z } from 'zod';

export interface WeatherData {
	location: string;
	temperature: {
		high: number;
		low: number;
		unit: 'celsius' | 'fahrenheit';
	};
	condition: string;
	humidity: number;
	windSpeed: number;
	date?: string;
}

export const weatherTools = {
	weather: tool({
		description: 'Get the current weather in a location',
		inputSchema: z.object({
			location: z.string().describe('The city and state, e.g. San Francisco, CA'),
			unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
		}),
		execute: async ({ location, unit = 'fahrenheit' }) => {
			// Mock weather data
			const temp = unit === 'celsius' ? 22 : 72;
			const weatherData: WeatherData = {
				location,
				temperature: {
					high: unit === 'celsius' ? 25 : 77,
					low: unit === 'celsius' ? 18 : 64,
					unit,
				},
				condition: 'sunny',
				humidity: 65,
				windSpeed: 10,
			};

			return {
				...weatherData,
				temperature: temp,
				message: `Current weather in ${location}: ${weatherData.condition}, ${temp}°${unit === 'celsius' ? 'C' : 'F'}`,
			};
		},
	}),

	getWeatherForecast: tool({
		description: 'Get weather forecast for a specific location and date',
		inputSchema: z.object({
			location: z.string().describe('City or location name'),
			date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
			unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
		}),
		execute: async ({ location, date, unit = 'fahrenheit' }) => {
			// Mock weather forecast data
			const weatherData: WeatherData = {
				location,
				temperature: {
					high: unit === 'celsius' ? 25 : 77,
					low: unit === 'celsius' ? 18 : 64,
					unit,
				},
				condition: 'sunny',
				humidity: 65,
				windSpeed: 10,
			};

			if (date) {
				weatherData.date = date;
			}

			return {
				...weatherData,
				message: `Weather forecast for ${location}${date ? ` on ${date}` : ''}: ${weatherData.condition}, ${weatherData.temperature.low}-${weatherData.temperature.high}°${unit === 'celsius' ? 'C' : 'F'}`,
			};
		},
	}),
};

