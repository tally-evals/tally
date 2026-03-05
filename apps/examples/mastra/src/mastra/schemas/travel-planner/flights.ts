import { z } from 'zod';

export const searchFlightsParamsSchema = z.object({
    origin: z.string().describe('Departure city and airport code (e.g., "San Francisco, SFO")'),
    destination: z.string().describe('Arrival city and airport code (e.g., "New York, JFK")'),
    departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
    returnDate: z.string().optional().describe('Return date in YYYY-MM-DD format (for round trip)'),
    passengers: z.number().default(1).describe('Number of passengers'),
    class: z.enum(["Economy", "Business", "First"]).default("Economy").describe('Flight cabin class'),
    maxPrice: z.number().optional().describe('Maximum price per passenger'),
    maxStops: z.number().min(0).max(2).optional().describe('Maximum number of stops (0 = direct flight)'),
    airlines: z.array(z.string()).optional().describe('Preferred airlines'),
    departureTimeRange: z.object({
        earliest: z.string().optional().describe('Earliest departure time (HH:mm)'),
        latest: z.string().optional().describe('Latest departure time (HH:mm)')
    }).optional(),
    sortBy: z.enum(['price', 'duration', 'departureTime', 'arrivalTime']).default('price').describe('Sort results by')
})

export const flightSchema = z.object({
    id: z.string(),
    airline: z.string(),
    flightNumber: z.string(),
    class: z.enum(['Economy', 'Business', 'First']),
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
    stops: z.number(),
    aircraft: z.string(),
});

export type SearchFlightsParams = z.infer<typeof searchFlightsParamsSchema>;
export type Flight = z.infer<typeof flightSchema>;