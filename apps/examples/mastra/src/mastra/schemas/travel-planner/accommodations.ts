import { z } from 'zod';

export const searchAccommodationsParamsSchema = z.object({
  location: z.string().describe('City or location name'),
  checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
  checkOut: z.string().describe('Check-out date in YYYY-MM-DD format'),
  type: z.enum(['hotel', 'apartment', 'hostel', 'resort', 'villa']).optional().describe('Preferred accommodation type'),
  minRating: z.number().min(1).max(5).optional().describe('Minimum rating (1-5)'),
  maxPricePerNight: z.number().optional().describe('Maximum price per night'),
  amenities: z.array(z.string()).optional().describe('Required amenities'),
  starRating: z.number().min(1).max(5).optional().describe('Minimum star rating'),
  distanceFromCityCenter: z.number().optional().describe('Maximum distance from city center in miles'),
  cancellationPolicy: z.enum(['free', 'moderate', 'strict']).optional().describe('Preferred cancellation policy'),
  sortBy: z.enum(['price', 'rating', 'distance', 'reviewCount']).default('rating').describe('Sort results by'),
});

export const accommodationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['hotel', 'apartment', 'hostel', 'resort', 'villa']),
  location: z.string(),
  address: z.string(),
  pricePerNight: z.number(),
  rating: z.number(),
  amenities: z.array(z.string()),
  starRating: z.number(),
  policies: z.object({
    cancellation: z.string(),
    pets: z.boolean(),
    smoking: z.boolean(),
  }),
  distance: z
    .object({
      cityCenter: z.number(),
      airport: z.number().optional(),
    })
    .optional(),
});

export type SearchAccommodationsParams = z.infer<typeof searchAccommodationsParamsSchema>;
export type Accommodation = z.infer<typeof accommodationSchema>;


