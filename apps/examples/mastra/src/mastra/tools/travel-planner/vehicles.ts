import { createTool } from '@mastra/core/tools';
import { searchVehiclesParamsSchema, vehicleSchema, type Vehicle } from '~/schemas/travel-planner/vehicle';
import { z } from 'zod';
import { faker } from '@faker-js/faker';

/** Maximum number of vehicle results to return */
const RESULTS_LIMIT = 5;

/** Minimum number of vehicles to generate before filtering */
const MIN_GENERATED_VEHICLES = 10;

/** Vehicle types */
const VEHICLE_TYPES = ['sedan', 'suv', 'van', 'sports car', 'luxury', 'compact', 'convertible', 'truck'] as const;

/** Vehicle makes and their typical models */
const VEHICLE_CATALOG = {
    Toyota: {
        types: ['sedan', 'suv', 'compact', 'truck'],
        models: {
            sedan: ['Camry', 'Corolla', 'Avalon'],
            suv: ['RAV4', 'Highlander', '4Runner'],
            compact: ['Yaris', 'Corolla'],
            truck: ['Tacoma', 'Tundra'],
        },
    },
    Honda: {
        types: ['sedan', 'suv', 'compact'],
        models: {
            sedan: ['Accord', 'Civic'],
            suv: ['CR-V', 'Pilot'],
            compact: ['Fit', 'Civic'],
        },
    },
    BMW: {
        types: ['sedan', 'suv', 'luxury', 'sports car'],
        models: {
            sedan: ['3 Series', '5 Series', '7 Series'],
            suv: ['X3', 'X5', 'X7'],
            luxury: ['7 Series', 'M5'],
            'sports car': ['M3', 'M4', 'Z4'],
        },
    },
    Mercedes: {
        types: ['sedan', 'suv', 'luxury', 'convertible'],
        models: {
            sedan: ['C-Class', 'E-Class', 'S-Class'],
            suv: ['GLC', 'GLE', 'G-Class'],
            luxury: ['S-Class', 'Maybach'],
            convertible: ['SL', 'E-Class Cabriolet'],
        },
    },
    Tesla: {
        types: ['sedan', 'suv', 'luxury'],
        models: {
            sedan: ['Model 3', 'Model S'],
            suv: ['Model X', 'Model Y'],
            luxury: ['Model S Plaid'],
        },
    },
    Ford: {
        types: ['sedan', 'suv', 'truck', 'van'],
        models: {
            sedan: ['Fusion', 'Taurus'],
            suv: ['Explorer', 'Escape', 'Expedition'],
            truck: ['F-150', 'Ranger'],
            van: ['Transit'],
        },
    },
    Chevrolet: {
        types: ['sedan', 'suv', 'truck', 'compact'],
        models: {
            sedan: ['Malibu', 'Impala'],
            suv: ['Tahoe', 'Equinox', 'Suburban'],
            truck: ['Silverado', 'Colorado'],
            compact: ['Spark', 'Cruze'],
        },
    },
    Audi: {
        types: ['sedan', 'suv', 'luxury', 'sports car'],
        models: {
            sedan: ['A4', 'A6', 'A8'],
            suv: ['Q5', 'Q7', 'Q8'],
            luxury: ['A8', 'e-tron GT'],
            'sports car': ['R8', 'TT'],
        },
    },
    Nissan: {
        types: ['sedan', 'suv', 'compact', 'sports car'],
        models: {
            sedan: ['Altima', 'Maxima'],
            suv: ['Rogue', 'Pathfinder'],
            compact: ['Versa', 'Sentra'],
            'sports car': ['GT-R', '370Z'],
        },
    },
    Mazda: {
        types: ['sedan', 'suv', 'compact', 'convertible'],
        models: {
            sedan: ['Mazda3', 'Mazda6'],
            suv: ['CX-5', 'CX-9'],
            compact: ['Mazda2', 'Mazda3'],
            convertible: ['MX-5 Miata'],
        },
    },
};

/** Common vehicle features */
const FEATURES_POOL = [
    'GPS Navigation', 'Bluetooth', 'Backup Camera', 'Lane Assist', 'Adaptive Cruise Control',
    'Heated Seats', 'Sunroof', 'Apple CarPlay', 'Android Auto', 'USB Charging',
    'Leather Seats', 'Parking Sensors', 'Keyless Entry', 'Remote Start', 'Collision Warning',
];

/** Vehicle colors */
const COLORS = ['Black', 'White', 'Silver', 'Gray', 'Blue', 'Red', 'Green', 'Brown', 'Gold', 'Orange'];

/**
 * Generates a stable numeric seed from the main search parameters.
 */
function generateSeed(location: string, startDate: string): number {
    const seedString = `${location.toLowerCase()}-${startDate}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        const char = seedString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Gets a random make that supports the given vehicle type
 */
function getMakeForType(seededFaker: typeof faker, vehicleType: string): string {
    const validMakes = Object.entries(VEHICLE_CATALOG)
        .filter(([_, info]) => info.types.includes(vehicleType as any))
        .map(([make]) => make);
    
    return validMakes.length > 0 
        ? seededFaker.helpers.arrayElement(validMakes)
        : 'Toyota';
}

/**
 * Gets appropriate fuel types for vehicle type
 */
function getFuelType(seededFaker: typeof faker, make: string, vehicleType: string): 'gasoline' | 'diesel' | 'electric' | 'hybrid' {
    if (make === 'Tesla') return 'electric';
    
    if (vehicleType === 'sports car' || vehicleType === 'luxury') {
        return seededFaker.helpers.weightedArrayElement([
            { value: 'gasoline' as const, weight: 5 },
            { value: 'electric' as const, weight: 2 },
            { value: 'hybrid' as const, weight: 2 },
        ]);
    }
    
    return seededFaker.helpers.weightedArrayElement([
        { value: 'gasoline' as const, weight: 6 },
        { value: 'diesel' as const, weight: 2 },
        { value: 'electric' as const, weight: 1 },
        { value: 'hybrid' as const, weight: 2 },
    ]);
}

/**
 * Generates realistic price per day based on vehicle type and year
 */
function generatePrice(seededFaker: typeof faker, vehicleType: string, year: number): number {
    const baseRanges = {
        compact: { min: 35, max: 55 },
        sedan: { min: 45, max: 75 },
        suv: { min: 65, max: 110 },
        van: { min: 70, max: 120 },
        truck: { min: 60, max: 100 },
        convertible: { min: 80, max: 150 },
        luxury: { min: 150, max: 350 },
        'sports car': { min: 200, max: 500 },
    };

    const range = baseRanges[vehicleType as keyof typeof baseRanges] || { min: 50, max: 90 };
    const basePrice = seededFaker.number.int({ min: range.min, max: range.max });
    
    // Newer vehicles cost more
    const currentYear = new Date().getFullYear();
    const ageMultiplier = 0.85 + ((year - (currentYear - 5)) * 0.03);
    
    return Math.round(basePrice * Math.max(0.7, ageMultiplier));
}

/**
 * Gets vehicle capacity based on type
 */
function getCapacity(vehicleType: string): number {
    const capacities = {
        compact: 4,
        sedan: 5,
        suv: 7,
        van: 8,
        truck: 5,
        convertible: 2,
        luxury: 5,
        'sports car': 2,
    };
    return capacities[vehicleType as keyof typeof capacities] || 5;
}

/**
 * Generates vehicle specifications
 */
function generateSpecs(seededFaker: typeof faker, vehicleType: string, fuelType: string): Vehicle['specifications'] {
    const horsepower = vehicleType === 'sports car' ? seededFaker.number.int({ min: 400, max: 700 }) :
                      vehicleType === 'luxury' ? seededFaker.number.int({ min: 300, max: 500 }) :
                      vehicleType === 'compact' ? seededFaker.number.int({ min: 120, max: 180 }) :
                      seededFaker.number.int({ min: 180, max: 350 });

    const mpg = fuelType === 'electric' ? 'N/A (Electric)' :
                fuelType === 'hybrid' ? `${seededFaker.number.int({ min: 40, max: 60 })} MPG combined` :
                `${seededFaker.number.int({ min: 20, max: 35 })} MPG combined`;

    const acceleration = vehicleType === 'sports car' ? `${seededFaker.number.float({ min: 2.5, max: 4.5 }).toFixed(1)}s` :
                        vehicleType === 'luxury' ? `${seededFaker.number.float({ min: 4.0, max: 6.0 }).toFixed(1)}s` :
                        `${seededFaker.number.float({ min: 6.0, max: 10.0 }).toFixed(1)}s`;

    const topSpeed = vehicleType === 'sports car' ? `${seededFaker.number.int({ min: 180, max: 220 })} mph` :
                    vehicleType === 'luxury' ? `${seededFaker.number.int({ min: 140, max: 180 })} mph` :
                    `${seededFaker.number.int({ min: 110, max: 140 })} mph`;

    const engine = fuelType === 'electric' ? 'Electric Motor' :
                  fuelType === 'hybrid' ? `${seededFaker.number.float({ min: 1.5, max: 2.5 }).toFixed(1)}L Hybrid` :
                  `${seededFaker.number.float({ min: 1.5, max: 5.0 }).toFixed(1)}L ${fuelType === 'diesel' ? 'Diesel' : 'Gas'}`;

    return {
        engine,
        horsepower,
        mpg,
        acceleration,
        topSpeed,
    };
}

export const searchVehiclesTool = createTool({
    id: 'search-vehicles',
    description: 'Search for rental vehicles with advanced filtering',
    inputSchema: searchVehiclesParamsSchema,
    outputSchema: z.array(vehicleSchema),
    execute: async ({ context }) => {
        const {
            location,
            startDate,
            type,
            make,
            capacity,
            fuelType,
            transmission,
            maxPricePerDay,
            minRating,
            features,
            insuranceIncluded,
            sortBy = 'price',
        } = context;

        // Generate a stable seed from main parameters
        const seed = generateSeed(location, startDate);
        faker.seed(seed);

        // Build type pool
        let typePool = [...VEHICLE_TYPES];
        if (type) {
            // If user specifies a type, heavily weight it
            typePool = Array(6).fill(type).concat(VEHICLE_TYPES);
        }

        // Generate vehicles
        const generatedVehicles: Vehicle[] = [];
        const currentYear = new Date().getFullYear();

        for (let i = 0; i < MIN_GENERATED_VEHICLES; i++) {
            const vehicleType = faker.helpers.arrayElement(typePool);
            
            // Get make - prefer user-specified make if it supports this type
            let vehicleMake: string;
            if (make) {
                const catalog = VEHICLE_CATALOG[make as keyof typeof VEHICLE_CATALOG];
                vehicleMake = (catalog && catalog.types.includes(vehicleType as any)) ? make : getMakeForType(faker, vehicleType);
            } else {
                vehicleMake = getMakeForType(faker, vehicleType);
            }

            // Get model
            const catalog = VEHICLE_CATALOG[vehicleMake as keyof typeof VEHICLE_CATALOG];
            const models = catalog?.models[vehicleType as keyof typeof catalog.models] || ['Standard'];
            const model = faker.helpers.arrayElement(models);

            const year = faker.number.int({ min: currentYear - 5, max: currentYear });
            const vehicleCapacity = getCapacity(vehicleType);
            const vehicleFuelType = getFuelType(faker, vehicleMake, vehicleType);
            const vehicleTransmission = faker.helpers.weightedArrayElement([
                { value: 'automatic' as const, weight: 8 },
                { value: 'manual' as const, weight: 2 },
            ]);

            const pricePerDay = generatePrice(faker, vehicleType, year);
            const rating = Number((faker.number.float({ min: 3.5, max: 5.0 })).toFixed(1));

            const vehicleFeatures = faker.helpers.arrayElements(
                FEATURES_POOL,
                faker.number.int({ min: 4, max: Math.min(10, FEATURES_POOL.length) })
            );

            const insuranceIsIncluded = faker.datatype.boolean(0.6); // 60% include insurance

            const vehicle: Vehicle = {
                id: `VEH${seed.toString(36).toUpperCase().substring(0, 3)}${(i + 1).toString().padStart(3, '0')}`,
                name: `${year} ${vehicleMake} ${model}`,
                type: vehicleType,
                make: vehicleMake,
                model,
                year,
                capacity: vehicleCapacity,
                fuelType: vehicleFuelType,
                transmission: vehicleTransmission,
                color: faker.helpers.arrayElement(COLORS),
                pricePerDay,
                rating,
                features: vehicleFeatures,
                specifications: generateSpecs(faker, vehicleType, vehicleFuelType),
                insurance: {
                    included: insuranceIsIncluded,
                    dailyRate: insuranceIsIncluded ? undefined : faker.number.int({ min: 10, max: 35 }),
                    coverageType: insuranceIsIncluded ? 'Full Coverage' : 'Basic Coverage',
                },
            };

            generatedVehicles.push(vehicle);
        }

        // Apply filters
        let filteredVehicles = [...generatedVehicles];

        if (type) {
            filteredVehicles = filteredVehicles.filter(v => v.type === type);
        }

        if (make) {
            filteredVehicles = filteredVehicles.filter(v => 
                v.make.toLowerCase() === make.toLowerCase()
            );
        }

        if (capacity !== undefined) {
            filteredVehicles = filteredVehicles.filter(v => v.capacity >= capacity);
        }

        if (fuelType) {
            filteredVehicles = filteredVehicles.filter(v => v.fuelType === fuelType);
        }

        if (transmission) {
            filteredVehicles = filteredVehicles.filter(v => v.transmission === transmission);
        }

        if (maxPricePerDay !== undefined) {
            filteredVehicles = filteredVehicles.filter(v => v.pricePerDay <= maxPricePerDay);
        }

        if (minRating !== undefined) {
            filteredVehicles = filteredVehicles.filter(v => v.rating >= minRating);
        }

        if (features && features.length > 0) {
            filteredVehicles = filteredVehicles.filter(v =>
                features.every(feature =>
                    v.features.some(f => f.toLowerCase().includes(feature.toLowerCase()))
                )
            );
        }

        if (insuranceIncluded === true) {
            filteredVehicles = filteredVehicles.filter(v => v.insurance.included);
        }

        // Sort results
        filteredVehicles.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return a.pricePerDay - b.pricePerDay;
                case 'rating':
                    return b.rating - a.rating;
                case 'capacity':
                    return b.capacity - a.capacity;
                case 'year':
                    return b.year - a.year;
                default:
                    return a.pricePerDay - b.pricePerDay;
            }
        });

        // Cap results to RESULTS_LIMIT
        return filteredVehicles.slice(0, RESULTS_LIMIT);
    },
});
