import { createTool } from '@mastra/core/tools';
import { searchDiningParamsSchema, diningSchema, type SearchDiningParams, type Dining } from '~/schemas/travel-planner/dining';
import { z } from 'zod';
import { faker } from '@faker-js/faker';

/** Maximum number of dining results to return */
const RESULTS_LIMIT = 5;

/** Minimum number of dining options to generate before filtering */
const MIN_GENERATED_DINING = 10;

/** Cuisine types */
const CUISINES = [
    'Italian', 'French', 'Mediterranean', 'Asian', 'American', 
    'Mexican', 'Indian', 'Japanese', 'Thai', 'Chinese', 'Spanish', 'Greek'
];

/** Dining establishment types */
const DINING_TYPES = ['restaurant', 'cafe', 'bar', 'bistro', 'food truck', 'fine dining'] as const;

/** Ambiance types */
const AMBIANCE_TYPES = ['casual', 'formal', 'romantic', 'family-friendly', 'trendy', 'traditional', 'outdoor'];

/** Dress codes */
const DRESS_CODES = ['casual', 'smart casual', 'business casual', 'formal', 'no dress code'];

/** Dietary options pool */
const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher', 'dairy-free', 'nut-free'];

/** Name prefixes by cuisine */
const NAME_PREFIXES = {
    Italian: ['La', 'Il', 'Mama', 'Papa', 'Bella', 'Trattoria', 'Ristorante'],
    French: ['Le', 'La', 'Bistro', 'Café', 'Maison', 'Chez'],
    Mexican: ['El', 'La', 'Los', 'Casa', 'Taqueria'],
    Japanese: ['Sakura', 'Tokyo', 'Sushi', 'Ramen', 'Izakaya'],
    Chinese: ['Golden', 'Dragon', 'Jade', 'Imperial', 'Dynasty'],
    Indian: ['Taj', 'Spice', 'Curry', 'Tandoor', 'Masala'],
    American: ['The', 'Urban', 'Classic', 'Prime', 'Main Street'],
    Thai: ['Thai', 'Bangkok', 'Siam', 'Spice'],
    Greek: ['Taverna', 'Olive', 'Aegean', 'Athens'],
    Spanish: ['El', 'La', 'Tapas'],
    Mediterranean: ['Mediterranean', 'Olive Grove', 'Seaside'],
    Asian: ['Asian', 'Fusion', 'Wok'],
};

/** Name suffixes */
const NAME_SUFFIXES = [
    'Kitchen', 'House', 'Grill', 'Bistro', 'Restaurant', 'Cafe', 'Bar',
    'Eatery', 'Diner', 'Place', 'Spot', 'Room', 'Table', 'Garden'
];

/**
 * Generates a stable numeric seed from the main search parameters.
 */
function generateSeed(location: string, cuisine?: string): number {
    const seedString = `${location.toLowerCase()}-${cuisine?.toLowerCase() || 'all'}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        const char = seedString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Generates a realistic price based on dining type and rating
 */
function generatePrice(seededFaker: typeof faker, type: string, rating: number): number {
    const baseRanges = {
        'food truck': { min: 8, max: 15 },
        'cafe': { min: 10, max: 25 },
        'bar': { min: 15, max: 40 },
        'bistro': { min: 20, max: 45 },
        'restaurant': { min: 25, max: 80 },
        'fine dining': { min: 80, max: 300 },
    };

    const range = baseRanges[type as keyof typeof baseRanges] || { min: 20, max: 50 };
    const basePrice = seededFaker.number.int({ min: range.min, max: range.max });
    
    // Rating influences price
    const ratingMultiplier = 0.7 + (rating * 0.1);
    
    return Math.round(basePrice * ratingMultiplier);
}

/**
 * Gets price range symbol based on price per person
 */
function getPriceRange(pricePerPerson: number): '$' | '$$' | '$$$' | '$$$$' {
    if (pricePerPerson < 20) return '$';
    if (pricePerPerson < 50) return '$$';
    if (pricePerPerson < 100) return '$$$';
    return '$$$$';
}

/**
 * Generates a realistic restaurant name
 */
function generateDiningName(seededFaker: typeof faker, cuisine: string, type: string): string {
    const prefixes = NAME_PREFIXES[cuisine as keyof typeof NAME_PREFIXES] || ['The'];
    const prefix = seededFaker.helpers.arrayElement(prefixes);
    
    if (type === 'fine dining') {
        return `${prefix} ${seededFaker.helpers.arrayElement(['Grand', 'Royal', 'Elegant', 'Premier'])} ${seededFaker.helpers.arrayElement(['Dining', 'Room', 'Table'])}`;
    }
    
    const suffix = seededFaker.helpers.arrayElement(NAME_SUFFIXES);
    const middle = seededFaker.helpers.maybe(() => seededFaker.person.lastName(), { probability: 0.3 }) || '';
    
    return middle ? `${prefix} ${middle}'s ${suffix}` : `${prefix} ${suffix}`;
}

/**
 * Generates operating hours
 */
function generateHours(seededFaker: typeof faker, type: string): Dining['hours'] {
    const isCafe = type === 'cafe';
    const isBar = type === 'bar';
    const isFineDining = type === 'fine dining';
    
    if (isCafe) {
        return {
            monday: '06:30-20:00',
            tuesday: '06:30-20:00',
            wednesday: '06:30-20:00',
            thursday: '06:30-20:00',
            friday: '06:30-22:00',
            saturday: '07:00-22:00',
            sunday: '07:00-18:00',
        };
    }
    
    if (isBar) {
        return {
            monday: '16:00-02:00',
            tuesday: '16:00-02:00',
            wednesday: '16:00-02:00',
            thursday: '16:00-02:00',
            friday: '16:00-03:00',
            saturday: '16:00-03:00',
            sunday: '16:00-01:00',
        };
    }
    
    if (isFineDining) {
        return {
            wednesday: '18:00-22:00',
            thursday: '18:00-22:00',
            friday: '18:00-23:00',
            saturday: '18:00-23:00',
            sunday: '18:00-21:00',
        };
    }
    
    // Regular restaurant hours
    return {
        monday: '11:00-22:00',
        tuesday: '11:00-22:00',
        wednesday: '11:00-22:00',
        thursday: '11:00-22:00',
        friday: '11:00-23:00',
        saturday: '12:00-23:00',
        sunday: '12:00-21:00',
    };
}

export const searchDiningTool = createTool({
    id: 'search-dining',
    description: 'Search for dining options at a location with advanced filtering',
    inputSchema: searchDiningParamsSchema,
    outputSchema: z.array(diningSchema),
    execute: async ({ context }) => {
        const {
            location,
            cuisine,
            type,
            guests = 1,
            minRating,
            maxPricePerPerson,
            dietaryOptions,
            ambiance,
            distanceFromCityCenter,
            reservationsRequired,
            sortBy = 'rating',
        } = context;

        // Generate a stable seed from main parameters
        const seed = generateSeed(location, cuisine);
        faker.seed(seed);

        // Build cuisine pool
        let cuisinePool = [...CUISINES];
        if (cuisine) {
            // If user specifies a cuisine, heavily weight it
            cuisinePool = Array(8).fill(cuisine).concat(CUISINES);
        }

        // Build type pool
        let typePool = [...DINING_TYPES];
        if (type) {
            // If user specifies a type, heavily weight it
            typePool = Array(6).fill(type).concat(DINING_TYPES);
        }

        // Generate dining options
        const generatedDining: Dining[] = [];

        for (let i = 0; i < MIN_GENERATED_DINING; i++) {
            const diningType = faker.helpers.arrayElement(typePool);
            const primaryCuisine = faker.helpers.arrayElement(cuisinePool);
            
            // Generate rating (3.5 - 5.0, weighted towards higher ratings)
            const rating = Number((faker.number.float({ min: 3.5, max: 5.0 })).toFixed(1));
            
            const pricePerPerson = generatePrice(faker, diningType, rating);
            const priceRange = getPriceRange(pricePerPerson);
            
            // Secondary cuisines (sometimes)
            const cuisines = [primaryCuisine];
            if (faker.datatype.boolean(0.4)) {
                const secondary = faker.helpers.arrayElement(CUISINES.filter(c => c !== primaryCuisine));
                cuisines.push(secondary);
            }
            
            // Dietary options (random subset)
            const availableDietaryOptions = faker.helpers.arrayElements(
                DIETARY_OPTIONS, 
                faker.number.int({ min: 0, max: 4 })
            );
            
            // Ambiance
            const diningAmbiance = faker.helpers.arrayElement(AMBIANCE_TYPES);
            
            // Dress code
            const dressCode = diningType === 'fine dining' ? 'formal' :
                             diningType === 'food truck' ? 'no dress code' :
                             faker.helpers.arrayElement(['casual', 'smart casual']);
            
            // Reservations
            const reservationsAccepted = diningType !== 'food truck';
            const reservationsRequired = diningType === 'fine dining' || (rating > 4.5 && faker.datatype.boolean(0.6));
            
            const dining: Dining = {
                id: `DIN${seed.toString(36).toUpperCase().substring(0, 3)}${(i + 1).toString().padStart(3, '0')}`,
                name: generateDiningName(faker, primaryCuisine, diningType),
                type: diningType,
                location,
                pricePerPerson,
                rating,
                cuisines,
                dietaryOptions: availableDietaryOptions,
                ambiance: diningAmbiance,
                dressCode,
                reservations: {
                    required: reservationsRequired,
                    accepted: reservationsAccepted,
                    averageWaitTime: reservationsAccepted 
                        ? `${faker.number.int({ min: 5, max: 45 })}-${faker.number.int({ min: 10, max: 60 })} min`
                        : 'N/A',
                },
                hours: generateHours(faker, diningType),
                distance: {
                    cityCenter: Number((faker.number.float({ min: 0.1, max: 8 })).toFixed(1)),
                },
                priceRange,
            };

            generatedDining.push(dining);
        }

        // Apply filters
        let filteredDining = [...generatedDining];

        if (cuisine) {
            filteredDining = filteredDining.filter(d =>
                d.cuisines.some(c => c.toLowerCase() === cuisine.toLowerCase())
            );
        }

        if (type) {
            filteredDining = filteredDining.filter(d => d.type === type);
        }

        if (minRating !== undefined) {
            filteredDining = filteredDining.filter(d => d.rating >= minRating);
        }

        if (maxPricePerPerson !== undefined) {
            filteredDining = filteredDining.filter(d => d.pricePerPerson <= maxPricePerPerson);
        }

        if (dietaryOptions && dietaryOptions.length > 0) {
            filteredDining = filteredDining.filter(d =>
                dietaryOptions.every(option =>
                    d.dietaryOptions.some(o => o.toLowerCase().includes(option.toLowerCase()))
                )
            );
        }

        if (ambiance) {
            filteredDining = filteredDining.filter(d => 
                d.ambiance.toLowerCase() === ambiance.toLowerCase()
            );
        }

        if (distanceFromCityCenter !== undefined) {
            filteredDining = filteredDining.filter(d =>
                d.distance?.cityCenter && d.distance.cityCenter <= distanceFromCityCenter
            );
        }

        if (reservationsRequired === true) {
            filteredDining = filteredDining.filter(d => d.reservations.accepted);
        }

        // Sort results
        filteredDining.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return a.pricePerPerson - b.pricePerPerson;
                case 'rating':
                    return b.rating - a.rating;
                case 'distance':
                    return (a.distance?.cityCenter || 999) - (b.distance?.cityCenter || 999);
                default:
                    return b.rating - a.rating;
            }
        });

        // Cap results to RESULTS_LIMIT
        return filteredDining.slice(0, RESULTS_LIMIT);
    },
});
