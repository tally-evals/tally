import { createTool } from '@mastra/core/tools';
import { searchAccommodationsParamsSchema, accommodationSchema, type SearchAccommodationsParams, type Accommodation } from '~/schemas/travel-planner/accommodations';
import { z } from 'zod';
import { faker } from '@faker-js/faker';

/** Maximum number of accommodation results to return */
const RESULTS_LIMIT = 5;

/** Minimum number of accommodations to generate before filtering */
const MIN_GENERATED_ACCOMMODATIONS = 10;

/** Accommodation types with their typical characteristics */
const ACCOMMODATION_TYPES: Array<'hotel' | 'apartment' | 'hostel' | 'resort' | 'villa'> = [
    'hotel',
    'apartment',
    'hostel',
    'resort',
    'villa',
];

/** Common amenities by accommodation type */
const AMENITIES_POOL = {
    hotel: ['WiFi', 'Pool', 'Gym', 'Restaurant', 'Spa', 'Concierge', 'Business Center', 'Room Service', 'Parking', 'Bar'],
    apartment: ['WiFi', 'Kitchen', 'Washer', 'Dryer', 'Parking', 'Balcony', 'Workspace', 'Air Conditioning'],
    hostel: ['WiFi', 'Common Area', 'Kitchen', 'Lockers', '24h Reception', 'Shared Lounge', 'Tour Desk'],
    resort: ['WiFi', 'Pool', 'Gym', 'Restaurant', 'Spa', 'Beach Access', 'Water Sports', 'Golf', 'Kids Club', 'Bar'],
    villa: ['WiFi', 'Pool', 'Kitchen', 'Parking', 'Garden', 'BBQ', 'Hot Tub', 'Patio', 'Fireplace'],
};

/** Cancellation policies */
const CANCELLATION_POLICIES = ['free', 'moderate', 'strict'] as const;

/** Name prefixes for different accommodation types */
const NAME_PREFIXES = {
    hotel: ['Grand', 'Luxury', 'Boutique', 'Central', 'Budget', 'Downtown', 'Executive', 'Comfort'],
    apartment: ['Riverside', 'Downtown', 'Cozy', 'Modern', 'Urban', 'Skyline', 'City View'],
    hostel: ['Traveler\'s', 'Backpacker\'s', 'Nomad', 'Adventure', 'Social', 'Friendly'],
    resort: ['Sunset', 'Paradise', 'Ocean View', 'Tropical', 'Golden', 'Seaside', 'Palm'],
    villa: ['Mountain View', 'Hillside', 'Luxury', 'Private', 'Exclusive', 'Estate', 'Manor'],
};

/** Name suffixes for different accommodation types */
const NAME_SUFFIXES = {
    hotel: ['Hotel', 'Inn', 'Suites', 'Lodge', 'Palace'],
    apartment: ['Apartments', 'Residences', 'Suites', 'Condos', 'Flats'],
    hostel: ['Hostel', 'Backpackers', 'Guest House'],
    resort: ['Resort', 'Resort & Spa', 'Beach Resort'],
    villa: ['Villa', 'Estate', 'Retreat', 'Mansion'],
};

/**
 * Generates a stable numeric seed from the main search parameters.
 */
function generateSeed(location: string, checkIn: string): number {
    const seedString = `${location.toLowerCase()}-${checkIn}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        const char = seedString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Generates a realistic price based on accommodation type and star rating
 */
function generatePrice(seededFaker: typeof faker, type: string, stars: number): number {
    const baseRanges = {
        hostel: { min: 25, max: 60 },
        apartment: { min: 80, max: 200 },
        hotel: { min: 100, max: 400 },
        villa: { min: 200, max: 600 },
        resort: { min: 250, max: 700 },
    };

    const range = baseRanges[type as keyof typeof baseRanges] || { min: 100, max: 300 };
    const basePrice = seededFaker.number.int({ min: range.min, max: range.max });
    
    // Star rating multiplier
    const starMultiplier = 0.7 + (stars * 0.15);
    
    return Math.round(basePrice * starMultiplier);
}

/**
 * Generates appropriate amenities for accommodation type
 */
function generateAmenities(seededFaker: typeof faker, type: string): string[] {
    const pool = AMENITIES_POOL[type as keyof typeof AMENITIES_POOL] || AMENITIES_POOL.hotel;
    const count = seededFaker.number.int({ min: 3, max: Math.min(8, pool.length) });
    return seededFaker.helpers.arrayElements(pool, count);
}

/**
 * Generates a realistic accommodation name
 */
function generateAccommodationName(seededFaker: typeof faker, type: string): string {
    const prefix = seededFaker.helpers.arrayElement(NAME_PREFIXES[type as keyof typeof NAME_PREFIXES]);
    const suffix = seededFaker.helpers.arrayElement(NAME_SUFFIXES[type as keyof typeof NAME_SUFFIXES]);
    return `${prefix} ${suffix}`;
}

/**
 * Gets typical star rating for accommodation type
 */
function getStarRating(seededFaker: typeof faker, type: string): number {
    const ranges = {
        hostel: { min: 1, max: 2 },
        apartment: { min: 3, max: 4 },
        hotel: { min: 2, max: 5 },
        villa: { min: 3, max: 5 },
        resort: { min: 4, max: 5 },
    };

    const range = ranges[type as keyof typeof ranges] || { min: 2, max: 4 };
    return seededFaker.number.int(range);
}

export const searchAccommodationsTool = createTool({
    id: 'search-accommodations',
    description: 'Search for accommodations in a destination with advanced filtering',
    inputSchema: searchAccommodationsParamsSchema,
    outputSchema: z.array(accommodationSchema),
    execute: async ({ context }) => {
        const {
            location,
            checkIn,
            checkOut,
            type,
            minRating,
            maxPricePerNight,
            amenities,
            starRating,
            distanceFromCityCenter,
            cancellationPolicy,
            sortBy = 'rating',
        } = context;

        // Generate a stable seed from main parameters
        const seed = generateSeed(location, checkIn);
        faker.seed(seed);

        // Build accommodation type pool
        let typePool = [...ACCOMMODATION_TYPES];
        if (type) {
            // If user specifies a type, heavily weight it
            typePool = Array(6).fill(type).concat(ACCOMMODATION_TYPES);
        }

        // Generate a pool of accommodations
        const generatedAccommodations: Accommodation[] = [];

        for (let i = 0; i < MIN_GENERATED_ACCOMMODATIONS; i++) {
            const accommodationType = faker.helpers.arrayElement(typePool);
            const stars = getStarRating(faker, accommodationType);
            const pricePerNight = generatePrice(faker, accommodationType, stars);
            
            // Generate rating (3.0 - 5.0, weighted towards higher ratings)
            const rating = Number((faker.number.float({ min: 3.0, max: 5.0 })).toFixed(1));
            
            // Distance from city center (0.1 - 10 miles)
            const cityCenter = Number((faker.number.float({ min: 0.1, max: 10 })).toFixed(1));
            const airport = Math.random() > 0.3 ? Number((faker.number.float({ min: 5, max: 30 })).toFixed(1)) : undefined;
            
            const accommodation: Accommodation = {
                id: `ACC${seed.toString(36).toUpperCase().substring(0, 3)}${(i + 1).toString().padStart(3, '0')}`,
                name: generateAccommodationName(faker, accommodationType),
                type: accommodationType,
                location,
                address: faker.location.streetAddress(),
                pricePerNight,
                rating,
                amenities: generateAmenities(faker, accommodationType),
                starRating: stars,
                policies: {
                    cancellation: faker.helpers.arrayElement(CANCELLATION_POLICIES),
                    pets: faker.datatype.boolean(0.4), // 40% allow pets
                    smoking: faker.datatype.boolean(0.1), // 10% allow smoking
                },
                distance: {
                    cityCenter,
                    airport,
                },
            };

            generatedAccommodations.push(accommodation);
        }

        // Apply filters
        let filteredAccommodations = [...generatedAccommodations];

        if (type) {
            filteredAccommodations = filteredAccommodations.filter(acc => acc.type === type);
        }

        if (minRating !== undefined) {
            filteredAccommodations = filteredAccommodations.filter(acc => acc.rating >= minRating);
        }

        if (maxPricePerNight !== undefined) {
            filteredAccommodations = filteredAccommodations.filter(acc => acc.pricePerNight <= maxPricePerNight);
        }

        if (amenities && amenities.length > 0) {
            filteredAccommodations = filteredAccommodations.filter(acc =>
                amenities.every(amenity =>
                    acc.amenities.some(a => a.toLowerCase().includes(amenity.toLowerCase()))
                )
            );
        }

        if (starRating !== undefined) {
            filteredAccommodations = filteredAccommodations.filter(acc => acc.starRating >= starRating);
        }

        if (distanceFromCityCenter !== undefined) {
            filteredAccommodations = filteredAccommodations.filter(acc =>
                acc.distance?.cityCenter && acc.distance.cityCenter <= distanceFromCityCenter
            );
        }

        if (cancellationPolicy) {
            filteredAccommodations = filteredAccommodations.filter(acc => 
                acc.policies.cancellation === cancellationPolicy
            );
        }

        // Sort results
        filteredAccommodations.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return a.pricePerNight - b.pricePerNight;
                case 'rating':
                    return b.rating - a.rating;
                case 'distance':
                    return (a.distance?.cityCenter || 999) - (b.distance?.cityCenter || 999);
                default:
                    return b.rating - a.rating;
            }
        });

        // Cap results to RESULTS_LIMIT
        return filteredAccommodations.slice(0, RESULTS_LIMIT);
    },
});
