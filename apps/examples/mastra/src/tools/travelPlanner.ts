/**
 * Travel Planner Tools (Mastra Example)
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export interface Flight {
	id: string;
	airline: string;
	departure: {
		airport: string;
		time: string;
		date: string;
	};
	arrival: {
		airport: string;
		time: string;
		date: string;
	};
	price: number;
	duration: string;
}

export interface Accommodation {
	id: string;
	name: string;
	type: 'hotel' | 'apartment' | 'hostel';
	location: string;
	pricePerNight: number;
	rating: number;
	amenities: string[];
}

export const searchFlightsTool = createTool({
	id: 'search-flights',
	description: 'Search for available flights between two cities',
	inputSchema: z.object({
		origin: z.string().describe('Departure city and airport code (e.g., "San Francisco, SFO")'),
		destination: z.string().describe('Arrival city and airport code (e.g., "New York, JFK")'),
		departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
		returnDate: z.string().optional().describe('Return date in YYYY-MM-DD format (for round trip)'),
		passengers: z.number().optional().describe('Number of passengers (default: 1)'),
	}),
	outputSchema: z.object({
		flights: z.array(z.object({
			id: z.string(),
			airline: z.string(),
			departure: z.object({
				airport: z.string(),
				time: z.string(),
				date: z.string(),
			}),
			arrival: z.object({
				airport: z.string(),
				time: z.string(),
				date: z.string(),
			}),
			price: z.number(),
			duration: z.string(),
		})),
		count: z.number(),
		message: z.string(),
		error: z.boolean().optional(),
		missingFields: z.array(z.string()).optional(),
		suggestion: z.string().optional(),
	}),
	execute: async ({ context }) => {
		const { origin, destination, departureDate, returnDate, passengers = 1 } = context;

		// Validate required fields
		const missingFields: string[] = [];
		if (!origin || origin.trim() === '') missingFields.push('origin');
		if (!destination || destination.trim() === '') missingFields.push('destination');
		if (!departureDate || departureDate.trim() === '') missingFields.push('departureDate');

		if (missingFields.length > 0) {
			return {
				flights: [],
				count: 0,
				message: `Missing required fields: ${missingFields.join(', ')}`,
				error: true,
				missingFields,
				suggestion: `Please ask the user for: ${missingFields.map(f => {
					if (f === 'origin') return 'departure city and airport';
					if (f === 'destination') return 'destination city and airport';
					if (f === 'departureDate') return 'departure date';
					return f;
				}).join(', ')}`,
			};
		}

		// Mock flight data
		const flights: Flight[] = [
			{
				id: 'FL001',
				airline: 'Mock Airlines',
				departure: {
					airport: origin,
					time: '08:00',
					date: departureDate,
				},
				arrival: {
					airport: destination,
					time: '14:30',
					date: departureDate,
				},
				price: 299 * passengers,
				duration: '6h 30m',
			},
			{
				id: 'FL002',
				airline: 'Another Airline',
				departure: {
					airport: origin,
					time: '15:00',
					date: departureDate,
				},
				arrival: {
					airport: destination,
					time: '21:45',
					date: departureDate,
				},
				price: 349 * passengers,
				duration: '6h 45m',
			},
		];

		if (returnDate) {
			// Add return flights
			const returnFlights: Flight[] = [
				{
					id: 'FL003',
					airline: 'Mock Airlines',
					departure: {
						airport: destination,
						time: '10:00',
						date: returnDate,
					},
					arrival: {
						airport: origin,
						time: '16:30',
						date: returnDate,
					},
					price: 299 * passengers,
					duration: '6h 30m',
				},
			];
			flights.push(...returnFlights);
		}

		return {
			flights,
			count: flights.length,
			message: `Found ${flights.length} flight(s) from ${origin} to ${destination}`,
		};
	},
});

export const searchAccommodationsTool = createTool({
	id: 'search-accommodations',
	description: 'Search for available accommodations (hotels, apartments, hostels) in a location',
	inputSchema: z.object({
		location: z.string().describe('City or location name'),
		checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
		checkOut: z.string().describe('Check-out date in YYYY-MM-DD format'),
		type: z.enum(['hotel', 'apartment', 'hostel']).optional().describe('Preferred accommodation type'),
	}),
	outputSchema: z.object({
		accommodations: z.array(z.object({
			id: z.string(),
			name: z.string(),
			type: z.enum(['hotel', 'apartment', 'hostel']),
			location: z.string(),
			pricePerNight: z.number(),
			rating: z.number(),
			amenities: z.array(z.string()),
		})),
		count: z.number(),
		nights: z.number(),
		message: z.string(),
		error: z.boolean().optional(),
		missingFields: z.array(z.string()).optional(),
		suggestion: z.string().optional(),
	}),
	execute: async ({ context }) => {
		const { location, checkIn, checkOut, type } = context;

		// Validate required fields
		const missingFields: string[] = [];
		if (!location || location.trim() === '') missingFields.push('location');
		if (!checkIn || checkIn.trim() === '') missingFields.push('checkIn');
		if (!checkOut || checkOut.trim() === '') missingFields.push('checkOut');

		if (missingFields.length > 0) {
			return {
				accommodations: [],
				count: 0,
				nights: 0,
				message: `Missing required fields: ${missingFields.join(', ')}`,
				error: true,
				missingFields,
				suggestion: `Please ask the user for: ${missingFields.map(f => {
					if (f === 'location') return 'destination location';
					if (f === 'checkIn') return 'check-in date';
					if (f === 'checkOut') return 'check-out date';
					return f;
				}).join(', ')}`,
			};
		}

		// Mock accommodation data
		const accommodations: Accommodation[] = [
			{
				id: 'ACC001',
				name: 'Grand Hotel',
				type: 'hotel',
				location,
				pricePerNight: 150,
				rating: 4.5,
				amenities: ['WiFi', 'Pool', 'Gym', 'Restaurant'],
			},
			{
				id: 'ACC002',
				name: 'Cozy Apartment',
				type: 'apartment',
				location,
				pricePerNight: 80,
				rating: 4.2,
				amenities: ['WiFi', 'Kitchen', 'Washer'],
			},
			{
				id: 'ACC003',
				name: 'Budget Hostel',
				type: 'hostel',
				location,
				pricePerNight: 30,
				rating: 3.8,
				amenities: ['WiFi', 'Common Area'],
			},
		];

		const filtered = type ? accommodations.filter((acc) => acc.type === type) : accommodations;

		// Calculate total nights
		const checkInDate = new Date(checkIn);
		const checkOutDate = new Date(checkOut);
		const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

		return {
			accommodations: filtered,
			count: filtered.length,
			nights,
			message: `Found ${filtered.length} accommodation(s) in ${location} for ${nights} night(s)`,
		};
	},
});

export const getWeatherForecastTool = createTool({
	id: 'get-weather-forecast',
	description: 'Get weather forecast for a destination',
	inputSchema: z.object({
		location: z.string().describe('City or location name'),
		date: z.string().describe('Date in YYYY-MM-DD format'),
	}),
	outputSchema: z.object({
		location: z.string(),
		date: z.string(),
		temperature: z.object({
			high: z.number(),
			low: z.number(),
			unit: z.string(),
		}),
		condition: z.string(),
		humidity: z.number(),
		windSpeed: z.number(),
		message: z.string(),
		error: z.boolean().optional(),
		missingFields: z.array(z.string()).optional(),
		suggestion: z.string().optional(),
	}),
	execute: async ({ context }) => {
		const { location, date } = context;

		// Validate required fields
		const missingFields: string[] = [];
		if (!location || location.trim() === '') missingFields.push('location');
		if (!date || date.trim() === '') missingFields.push('date');

		if (missingFields.length > 0) {
			return {
				location: '',
				date: '',
				temperature: { high: 0, low: 0, unit: 'fahrenheit' },
				condition: '',
				humidity: 0,
				windSpeed: 0,
				message: `Missing required fields: ${missingFields.join(', ')}`,
				error: true,
				missingFields,
				suggestion: `Please ask the user for: ${missingFields.map(f => {
					if (f === 'location') return 'destination location';
					if (f === 'date') return 'date for the weather forecast';
					return f;
				}).join(', ')}`,
			};
		}

		// Mock weather data
		return {
			location,
			date,
			temperature: { high: 75, low: 60, unit: 'fahrenheit' },
			condition: 'sunny',
			humidity: 65,
			windSpeed: 10,
			message: `Weather forecast for ${location} on ${date}: Sunny, 60-75°F`,
		};
	},
});

export const travelPlannerTools = {
	searchFlights: searchFlightsTool,
	searchAccommodations: searchAccommodationsTool,
	getWeatherForecast: getWeatherForecastTool,
};

