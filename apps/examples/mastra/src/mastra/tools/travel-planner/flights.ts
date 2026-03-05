import { createTool } from '@mastra/core/tools';
import { searchFlightsParamsSchema, flightSchema, type Flight } from '~/schemas/travel-planner/flights';
import { z } from 'zod';
import { faker } from '@faker-js/faker';

/** Maximum number of flight results to return */
const RESULTS_LIMIT = 5;

/** Minimum number of flights to generate before filtering (ensures non-empty results) */
const MIN_GENERATED_FLIGHTS = 8;

/** Airline names pool for flight generation */
const AIRLINES = [
    'SkyWings Airlines',
    'Global Airways',
    'BudgetJet',
    'Premium International',
    'Connector Express',
    'Pacific Airlines',
    'Atlantic Airways',
    'Continental Express',
    'Northern Flights',
    'Southern Wings',
];

/** Aircraft types pool for flight generation */
const AIRCRAFT_TYPES = [
    'Boeing 737-800',
    'Airbus A320',
    'Boeing 787 Dreamliner',
    'Airbus A350',
    'Embraer E190',
    'Boeing 777-300ER',
    'Airbus A321neo',
    'Boeing 737 MAX 8',
];

/**
 * Generates a stable numeric seed from the main search parameters.
 * This ensures deterministic results for identical searches.
 */
function generateSeed(origin: string, destination: string, departureDate: string, flightClass: string): number {
    const seedString = `${origin.toLowerCase()}-${destination.toLowerCase()}-${departureDate}-${flightClass}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        const char = seedString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Generates a random time in HH:mm format
 */
function generateDepartureTime(seededFaker: typeof faker): string {
    const hour = seededFaker.number.int({ min: 5, max: 22 });
    const minute = seededFaker.helpers.arrayElement([0, 15, 30, 45]);
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Calculates arrival time based on departure time and duration in minutes
 */
function calculateArrivalTime(departureTime: string, durationMinutes: number): string {
    const [hours, minutes] = departureTime.split(':').map(Number);
    if (hours === undefined || minutes === undefined) {
        return '00:00'; // fallback
    }
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const arrivalHours = Math.floor(totalMinutes / 60) % 24;
    const arrivalMinutes = totalMinutes % 60;
    return `${arrivalHours.toString().padStart(2, '0')}:${arrivalMinutes.toString().padStart(2, '0')}`;
}

/**
 * Formats duration in minutes to "Xh Ym" format
 */
function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

/**
 * Generates price based on flight class and stops
 */
function generatePrice(seededFaker: typeof faker, flightClass: 'Economy' | 'Business' | 'First', stops: number): number {
    const basePrice = seededFaker.number.int({ min: 150, max: 400 });
    
    const classMultiplier = flightClass === 'Economy' ? 1 : flightClass === 'Business' ? 2.5 : 4;
    const stopsDiscount = stops > 0 ? 0.85 : 1; // Flights with stops are cheaper
    
    return Math.round(basePrice * classMultiplier * stopsDiscount);
}

export const searchFlightsTool = createTool({
    id: 'search-flights',
    description: 'Search for flights between two cities',
    inputSchema: searchFlightsParamsSchema,
    outputSchema: z.array(flightSchema),
    execute: async ({ context }) => {
        const {
            origin,
            destination,
            departureDate,
            passengers = 1,
            class: flightClass = 'Economy',
            maxPrice,
            maxStops,
            airlines,
            departureTimeRange,
            sortBy = 'price',
        } = context;

        // Generate a stable seed from main parameters
        const seed = generateSeed(origin, destination, departureDate, flightClass);
        faker.seed(seed);

        // Extract airport names from input (format: "City, CODE")
        const originAirport = origin.split(',')[0]?.trim() || origin;
        const destinationAirport = destination.split(',')[0]?.trim() || destination;

        // Build airline pool: if user specifies airlines, mix them with defaults
        // This ensures that searches with airline preferences will have matching results
        let airlinePool = [...AIRLINES];
        if (airlines && airlines.length > 0) {
            // Add user-specified airlines to the pool, giving them higher weight
            const userAirlines = airlines.flatMap(a => [a, a, a]); // 3x weight for user airlines
            airlinePool = [...userAirlines, ...AIRLINES];
        }

        // Generate a pool of flights (more than limit to allow filtering)
        const generatedFlights: Flight[] = [];
        
        for (let i = 0; i < MIN_GENERATED_FLIGHTS; i++) {
            const airline = faker.helpers.arrayElement(airlinePool);
            const airlineCode = airline?.split(' ')?.[0]?.substring(0, 2)?.toUpperCase() || 'XX';
            const flightNumber = `${airlineCode}${faker.number.int({ min: 100, max: 999 })}`;
            
            const stops = faker.helpers.weightedArrayElement([
                { value: 0, weight: 6 },  // Direct flights more common
                { value: 1, weight: 3 },
                { value: 2, weight: 1 },
            ]);
            
            // Duration: 2-12 hours, with stops adding more time
            const baseDuration = faker.number.int({ min: 120, max: 480 });
            const stopsDuration = stops * faker.number.int({ min: 60, max: 120 });
            const totalDuration = baseDuration + stopsDuration;
            
            const departureTime = generateDepartureTime(faker);
            const arrivalTime = calculateArrivalTime(departureTime, totalDuration);
            
            const price = generatePrice(faker, flightClass, stops) * passengers;
            
            const flight: Flight = {
                id: `FL${seed.toString(36).toUpperCase().substring(0, 4)}${(i + 1).toString().padStart(3, '0')}`,
                airline,
                flightNumber,
                class: flightClass,
                departure: {
                    airport: originAirport,
                    time: departureTime,
                    date: departureDate,
                },
                arrival: {
                    airport: destinationAirport,
                    time: arrivalTime,
                    date: departureDate, // Same day arrival (simplified)
                },
                price,
                duration: formatDuration(totalDuration),
                stops,
                aircraft: faker.helpers.arrayElement(AIRCRAFT_TYPES),
            };
            
            generatedFlights.push(flight);
        }

        // Apply filters
        let filteredFlights = [...generatedFlights];

        if (maxPrice !== undefined) {
            filteredFlights = filteredFlights.filter(f => f.price <= maxPrice);
        }

        if (maxStops !== undefined) {
            filteredFlights = filteredFlights.filter(f => f.stops <= maxStops);
        }

        if (airlines && airlines.length > 0) {
            filteredFlights = filteredFlights.filter(f =>
                airlines.some(airline =>
                    f.airline.toLowerCase().includes(airline.toLowerCase())
                )
            );
        }

        if (departureTimeRange) {
            filteredFlights = filteredFlights.filter(f => {
                const departTime = f.departure.time;
                if (departureTimeRange.earliest && departTime < departureTimeRange.earliest) return false;
                if (departureTimeRange.latest && departTime > departureTimeRange.latest) return false;
                return true;
            });
        }

        // Sort results
        filteredFlights.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return a.price - b.price;
                case 'duration':
                    return parseInt(a.duration) - parseInt(b.duration);
                case 'departureTime':
                    return a.departure.time.localeCompare(b.departure.time);
                case 'arrivalTime':
                    return a.arrival.time.localeCompare(b.arrival.time);
                default:
                    return a.price - b.price;
            }
        });

        // Cap results to RESULTS_LIMIT
        return filteredFlights.slice(0, RESULTS_LIMIT);
    },
});