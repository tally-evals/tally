import { z } from 'zod';

export const searchVehiclesParamsSchema = z.object({
    location: z.string().describe('City or rental location'),
    startDate: z.string().describe('Pick-up date in YYYY-MM-DD format'),
    endDate: z.string().describe('Drop-off date in YYYY-MM-DD format'),
    type: z
        .enum(['sedan', 'suv', 'van', 'sports car', 'luxury', 'compact', 'convertible', 'truck'])
        .optional()
        .describe('Vehicle type'),
    make: z.string().optional().describe('Vehicle make (e.g., Toyota, BMW, Tesla)'),
    capacity: z.number().min(1).max(9).optional().describe('Minimum passenger capacity'),
    fuelType: z.enum(['gasoline', 'diesel', 'electric', 'hybrid']).optional().describe('Preferred fuel type'),
    transmission: z.enum(['automatic', 'manual']).optional().describe('Transmission preference'),
    maxPricePerDay: z.number().optional().describe('Maximum price per day'),
    minRating: z.number().min(1).max(5).optional().describe('Minimum rating (1-5)'),
    features: z.array(z.string()).optional().describe('Required features (GPS, Bluetooth, etc.)'),
    insuranceIncluded: z.boolean().optional().describe('Only show vehicles with included insurance'),
    sortBy: z.enum(['price', 'rating', 'capacity', 'year']).default('price').describe('Sort results by'),
});

export const vehicleSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['sedan', 'suv', 'van', 'sports car', 'luxury', 'compact', 'convertible', 'truck']),
    make: z.string(),
    model: z.string(),
    year: z.number(),
    capacity: z.number(),
    fuelType: z.enum(['gasoline', 'diesel', 'electric', 'hybrid']),
    transmission: z.enum(['automatic', 'manual']),
    color: z.string(),
    pricePerDay: z.number(),
    rating: z.number(),
    features: z.array(z.string()),
    specifications: z.object({
        engine: z.string(),
        horsepower: z.number(),
        mpg: z.string(),
        acceleration: z.string(),
        topSpeed: z.string(),
    }),
    insurance: z.object({
        included: z.boolean(),
        dailyRate: z.number().optional(),
        coverageType: z.string(),
    }),
});

export type SearchVehiclesParams = z.infer<typeof searchVehiclesParamsSchema>;
export type Vehicle = z.infer<typeof vehicleSchema>;

