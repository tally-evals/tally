import { z } from 'zod';

export const searchDiningParamsSchema = z.object({
  location: z.string().describe('City or location name'),
  cuisine: z
    .enum([
      'Italian',
      'French',
      'Mediterranean',
      'Asian',
      'American',
      'Mexican',
      'Indian',
      'Japanese',
      'Thai',
      'Chinese',
      'Spanish',
      'Greek',
    ])
    .optional()
    .describe('Primary cuisine type'),
  type: z.enum(['restaurant', 'cafe', 'bar', 'bistro', 'food truck', 'fine dining']).optional().describe('Type of dining establishment'),
  guests: z.number().min(1).default(1).describe('Number of guests'),
  minRating: z.number().min(1).max(5).optional().describe('Minimum rating (1-5)'),
  maxPricePerPerson: z.number().optional().describe('Maximum price per person'),
  dietaryOptions: z.array(z.string()).optional().describe('Required dietary options (vegetarian, vegan, gluten-free, etc.)'),
  ambiance: z
    .enum(['casual', 'formal', 'romantic', 'family-friendly', 'trendy', 'traditional', 'outdoor'])
    .optional()
    .describe('Preferred ambiance'),
  distanceFromCityCenter: z.number().optional().describe('Maximum distance from city center in miles'),
  reservationsRequired: z.boolean().optional().describe('Only show places that accept reservations'),
  sortBy: z.enum(['rating', 'price', 'distance', 'reviewCount']).default('rating').describe('Sort results by'),
});

export const diningSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['restaurant', 'cafe', 'bar', 'bistro', 'food truck', 'fine dining']),
  location: z.string(),
  pricePerPerson: z.number(),
  rating: z.number(),
  cuisines: z.array(z.string()),
  dietaryOptions: z.array(z.string()),
  ambiance: z.string(),
  dressCode: z.string(),
  reservations: z.object({
    required: z.boolean(),
    accepted: z.boolean(),
    averageWaitTime: z.string(),
  }),
  hours: z.object({
    monday: z.string().optional(),
    tuesday: z.string().optional(),
    wednesday: z.string().optional(),
    thursday: z.string().optional(),
    friday: z.string().optional(),
    saturday: z.string().optional(),
    sunday: z.string().optional(),
  }),
  distance: z
    .object({
      cityCenter: z.number(),
    })
    .optional(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$']),
});

export type SearchDiningParams = z.infer<typeof searchDiningParamsSchema>;
export type Dining = z.infer<typeof diningSchema>;


