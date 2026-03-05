/**
 * Travel Planner Tools (Example - AI SDK)
 */

import { tool } from 'ai';
import { z } from 'zod';

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  class: 'Economy' | 'Business' | 'First';
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
  stops: number;
  aircraft: string;
}

export interface Accommodation {
  id: string;
  name: string;
  type: 'hotel' | 'apartment' | 'hostel' | 'resort' | 'villa';
  location: string;
  address: string;
  pricePerNight: number;
  rating: number;
  amenities: string[];
  starRating: number;
  policies: {
    cancellation: string;
    pets: boolean;
    smoking: boolean;
  };
  distance?: {
    cityCenter: number;
    airport?: number;
  };
}

export interface Dining {
  id: string;
  name: string;
  type: 'restaurant' | 'cafe' | 'bar' | 'fine dining';
  location: string;
  pricePerPerson: number;
  rating: number;
  cuisines: string[];
  dietaryOptions: string[];
  ambiance: string;
  dressCode: string;
  reservations: {
    required: boolean;
    accepted: boolean;
    averageWaitTime: string;
  };
  hours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  distance?: {
    cityCenter: number;
  };
  priceRange: '$' | '$$' | '$$$' | '$$$$';
}

export interface Vehicle {
  id: string;
  name: string;
  type: 'sedan' | 'suv' | 'van' | 'sports car' | 'luxury' | 'compact' | 'convertible' | 'truck';
  make: string;
  model: string;
  year: number;
  capacity: number;
  fuelType: 'gasoline' | 'diesel' | 'electric' | 'hybrid';
  transmission: 'automatic' | 'manual';
  color: string;
  pricePerDay: number;
  rating: number;
  features: string[];
  specifications: {
    engine: string;
    horsepower: number;
    mpg: string;
    acceleration: string;
    topSpeed: string;
  };
  insurance: {
    included: boolean;
    dailyRate?: number;
    coverageType: string;
  };
}

export const travelPlannerTools = {
  searchFlights: tool({
    description: 'Search for available flights between two cities with advanced filtering',
    inputSchema: z.object({
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
    }),
    execute: async ({ origin, destination, departureDate, returnDate, passengers = 1, class: flightClass, maxPrice, maxStops, airlines, departureTimeRange, sortBy }) => {
      // Validate required fields
      const missingFields: string[] = [];
      if (!origin || origin.trim() === '') missingFields.push('origin');
      if (!destination || destination.trim() === '') missingFields.push('destination');
      if (!departureDate || departureDate.trim() === '') missingFields.push('departureDate');

      if (missingFields.length > 0) {
        return {
          error: true,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missingFields,
          suggestion: `Please ask the user for: ${missingFields.map(f => {
            if (f === 'origin') return 'departure city and airport';
            if (f === 'destination') return 'destination city and airport';
            if (f === 'departureDate') return 'departure date';
            return f;
          }).join(', ')}`,
        };
      }

      // Extended mock flight data with more airlines and options
      const mockFlights: Flight[] = [
        {
          id: 'FL001',
          airline: 'SkyWings Airlines',
          flightNumber: 'SW234',
          class: flightClass,
          departure: {
            airport: origin.split(',')[0] || origin,
            time: '08:00',
            date: departureDate,
          },
          arrival: {
            airport: destination.split(',')[0] || destination,
            time: '14:30',
            date: departureDate,
          },
          price: flightClass === 'Economy' ? 299 : flightClass === 'Business' ? 899 : 1599,
          duration: '6h 30m',
          stops: 0,
          aircraft: 'Boeing 737-800',
        },
        {
          id: 'FL002',
          airline: 'Global Airways',
          flightNumber: 'GA567',
          class: flightClass,
          departure: {
            airport: origin.split(',')[0] || origin,
            time: '10:15',
            date: departureDate,
          },
          arrival: {
            airport: destination.split(',')[0] || destination,
            time: '13:45',
            date: departureDate,
          },
          price: flightClass === 'Economy' ? 349 : flightClass === 'Business' ? 1099 : 1899,
          duration: '5h 30m',
          stops: 0,
          aircraft: 'Airbus A320',
        },
        {
          id: 'FL003',
          airline: 'BudgetJet',
          flightNumber: 'BJ890',
          class: 'Economy',
          departure: {
            airport: origin.split(',')[0] || origin,
            time: '06:30',
            date: departureDate,
          },
          arrival: {
            airport: destination.split(',')[0] || destination,
            time: '15:15',
            date: departureDate,
          },
          price: 199,
          duration: '8h 45m',
          stops: 1,
          aircraft: 'Boeing 737-900',
        },
        {
          id: 'FL004',
          airline: 'Premium International',
          flightNumber: 'PI123',
          class: flightClass,
          departure: {
            airport: origin.split(',')[0] || origin,
            time: '14:00',
            date: departureDate,
          },
          arrival: {
            airport: destination.split(',')[0] || destination,
            time: '20:15',
            date: departureDate,
          },
          price: flightClass === 'Economy' ? 425 : flightClass === 'Business' ? 1299 : 2299,
          duration: '6h 15m',
          stops: 0,
          aircraft: 'Boeing 787 Dreamliner',
        },
        {
          id: 'FL005',
          airline: 'Connector Express',
          flightNumber: 'CE456',
          class: flightClass,
          departure: {
            airport: origin.split(',')[0] || origin,
            time: '09:00',
            date: departureDate,
          },
          arrival: {
            airport: destination.split(',')[0] || destination,
            time: '16:30',
            date: departureDate,
          },
          price: flightClass === 'Economy' ? 275 : flightClass === 'Business' ? 825 : 1475,
          duration: '7h 30m',
          stops: 0,
          aircraft: 'Embraer E190',
        }
      ];

      let flights = mockFlights.map(flight => ({
        ...flight,
        price: flight.price * passengers
      }));

      // Apply filters
      if (maxPrice) {
        flights = flights.filter(f => f.price <= maxPrice);
      }

      if (maxStops !== undefined) {
        flights = flights.filter(f => f.stops <= maxStops);
      }

      if (airlines && airlines.length > 0) {
        flights = flights.filter(f => airlines.some(airline =>
          f.airline.toLowerCase().includes(airline.toLowerCase())
        ));
      }

      if (departureTimeRange) {
        flights = flights.filter(f => {
          const departTime = f.departure.time;
          if (departureTimeRange.earliest && departTime < departureTimeRange.earliest) return false;
          if (departureTimeRange.latest && departTime > departureTimeRange.latest) return false;
          return true;
        });
      }

      // Sort results
      flights.sort((a, b) => {
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

      if (returnDate) {
        const returnFlights = flights.map(flight => ({
          ...flight,
          id: `RET_${flight.id}`,
          flightNumber: `RET-${flight.flightNumber}`,
          departure: {
            ...flight.departure,
            airport: destination.split(',')[0] || destination,
            airportCode: destination.split(',')[1]?.trim() || 'JFK',
            time: flight.departure.time === '08:00' ? '10:00' :
              flight.departure.time === '10:15' ? '11:30' :
                flight.departure.time === '06:30' ? '08:45' :
                  flight.departure.time === '14:00' ? '16:15' : '12:00',
            date: returnDate,
          },
          arrival: {
            ...flight.arrival,
            airport: origin.split(',')[0] || origin,
            airportCode: origin.split(',')[1]?.trim() || 'SFO',
            time: flight.arrival.time === '14:30' ? '16:30' :
              flight.arrival.time === '13:45' ? '15:45' :
                flight.arrival.time === '15:15' ? '18:15' :
                  flight.arrival.time === '20:15' ? '22:15' : '14:00',
            date: returnDate,
          }
        }));
        flights = [...flights, ...returnFlights];
      }

      return {
        flights,
        count: flights.length,
        message: `Found ${flights.length} flight(s) from ${origin} to ${destination}`,
      };
    },
  }),

  searchAccommodations: tool({
    description: 'Search for available accommodations in a destination with advanced filtering',
    inputSchema: z.object({
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
      sortBy: z.enum(['price', 'rating', 'distance', 'reviewCount']).default('rating').describe('Sort results by')
    }),
    execute: async ({ location, checkIn, checkOut, type, minRating, maxPricePerNight, amenities, starRating, distanceFromCityCenter, cancellationPolicy, sortBy }) => {
      // Validate required fields
      const missingFields: string[] = [];
      if (!location || location.trim() === '') missingFields.push('location');
      if (!checkIn || checkIn.trim() === '') missingFields.push('checkIn');
      if (!checkOut || checkOut.trim() === '') missingFields.push('checkOut');

      if (missingFields.length > 0) {
        return {
          error: true,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missingFields,
          suggestion: `Please ask the user for: ${missingFields.map(f => {
            if (f === 'location') return 'destination location';
            if (f === 'checkIn') return 'check-in date';
            if (f === 'checkOut') return 'check-out date';
            return f;
          }).join(', ')}`,
        };
      }

      // Extended mock accommodation data
      const accommodations: Accommodation[] = [
        {
          id: 'ACC001',
          name: 'Grand Plaza Hotel',
          type: 'hotel',
          location,
          address: '123 Main St, Downtown',
          pricePerNight: 250,
          rating: 4.7,
          amenities: ['WiFi', 'Pool', 'Gym', 'Restaurant', 'Spa', 'Concierge', 'Business Center'],
          starRating: 5,
          policies: {
            cancellation: 'free',
            pets: false,
            smoking: false
          },
          distance: { cityCenter: 0.2, airport: 15 },
        },
        {
          id: 'ACC002',
          name: 'Riverside Apartments',
          type: 'apartment',
          location,
          address: '456 River Road',
          pricePerNight: 120,
          rating: 4.4,
          amenities: ['WiFi', 'Kitchen', 'Washer', 'Dryer', 'Parking', 'Balcony'],
          starRating: 4,
          policies: {
            cancellation: 'moderate',
            pets: true,
            smoking: false
          },
          distance: { cityCenter: 1.5 },
        },
        {
          id: 'ACC003',
          name: 'Traveler\'s Hostel',
          type: 'hostel',
          location,
          address: '789 Backpacker Lane',
          pricePerNight: 35,
          rating: 3.9,
          amenities: ['WiFi', 'Common Area', 'Kitchen', 'Lockers', '24h Reception'],
          starRating: 2,
          policies: {
            cancellation: 'free',
            pets: false,
            smoking: false
          },
          distance: { cityCenter: 0.8 },
        },
        {
          id: 'ACC004',
          name: 'Sunset Resort & Spa',
          type: 'resort',
          location,
          address: '321 Beach Boulevard',
          pricePerNight: 450,
          rating: 4.8,
          amenities: ['WiFi', 'Pool', 'Gym', 'Restaurant', 'Spa', 'Beach Access', 'Water Sports', 'Golf'],
          starRating: 5,
          policies: {
            cancellation: 'moderate',
            pets: true,
            smoking: false
          },
          distance: { cityCenter: 5, airport: 8 },
        },
        {
          id: 'ACC005',
          name: 'Mountain View Villa',
          type: 'villa',
          location,
          address: '555 Highland Drive',
          pricePerNight: 320,
          rating: 4.6,
          amenities: ['WiFi', 'Pool', 'Kitchen', 'Parking', 'Garden', 'BBQ', 'Hot Tub'],
          starRating: 4,
          policies: {
            cancellation: 'strict',
            pets: true,
            smoking: false
          },
          distance: { cityCenter: 8, airport: 20 },
        },
        {
          id: 'ACC006',
          name: 'Boutique Inn',
          type: 'hotel',
          location,
          address: '222 Arts District',
          pricePerNight: 180,
          rating: 4.3,
          amenities: ['WiFi', 'Restaurant', 'Art Gallery', 'Rooftop Bar'],
          starRating: 3,
          policies: {
            cancellation: 'free',
            pets: false,
            smoking: false
          },
          distance: { cityCenter: 0.5 },
        },
        {
          id: 'ACC007',
          name: 'Budget Suites Extended Stay',
          type: 'hotel',
          location,
          address: '888 Business Park',
          pricePerNight: 95,
          rating: 4.0,
          amenities: ['WiFi', 'Kitchen', 'Laundry', 'Parking', 'Workspace'],
          starRating: 3,
          policies: {
            cancellation: 'moderate',
            pets: true,
            smoking: false
          },
          distance: { cityCenter: 3, airport: 5 },
        }
      ];

      // Apply filters
      let filtered = accommodations;

      if (type) {
        filtered = filtered.filter((acc) => acc.type === type);
      }

      if (minRating) {
        filtered = filtered.filter(acc => acc.rating >= minRating);
      }

      if (maxPricePerNight) {
        filtered = filtered.filter(acc => acc.pricePerNight <= maxPricePerNight);
      }

      if (amenities && amenities.length > 0) {
        filtered = filtered.filter(acc =>
          amenities.every(amenity =>
            acc.amenities.some(a => a.toLowerCase().includes(amenity.toLowerCase()))
          )
        );
      }

      if (starRating) {
        filtered = filtered.filter(acc => acc.starRating >= starRating);
      }

      if (distanceFromCityCenter) {
        filtered = filtered.filter(acc =>
          acc.distance?.cityCenter && acc.distance.cityCenter <= distanceFromCityCenter
        );
      }

      if (cancellationPolicy) {
        filtered = filtered.filter(acc => acc.policies.cancellation === cancellationPolicy);
      }

      // Sort results
      filtered.sort((a, b) => {
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
  }),

  searchDining: tool({
    description: 'Search for dining options at a location with advanced filtering',
    inputSchema: z.object({
      location: z.string().describe('City or location name'),
      cuisine: z.enum(['Italian', 'French', 'Mediterranean', 'Asian', 'American', 'Mexican', 'Indian', 'Japanese', 'Thai', 'Chinese', 'Spanish', 'Greek']).optional().describe('Primary cuisine type'),
      type: z.enum(['restaurant', 'cafe', 'bar', 'bistro', 'food truck', 'fine dining']).optional().describe('Type of dining establishment'),
      guests: z.number().min(1).default(1).describe('Number of guests'),
      minRating: z.number().min(1).max(5).optional().describe('Minimum rating (1-5)'),
      maxPricePerPerson: z.number().optional().describe('Maximum price per person'),
      dietaryOptions: z.array(z.string()).optional().describe('Required dietary options (vegetarian, vegan, gluten-free, etc.)'),
      ambiance: z.enum(['casual', 'formal', 'romantic', 'family-friendly', 'trendy', 'traditional', 'outdoor']).optional().describe('Preferred ambiance'),
      distanceFromCityCenter: z.number().optional().describe('Maximum distance from city center in miles'),
      reservationsRequired: z.boolean().optional().describe('Only show places that accept reservations'),
      sortBy: z.enum(['rating', 'price', 'distance', 'reviewCount']).default('rating').describe('Sort results by')
    }),
    execute: async ({ location, cuisine, type, guests = 1, minRating, maxPricePerPerson, dietaryOptions, ambiance, distanceFromCityCenter, reservationsRequired, sortBy }) => {
      // Validate required fields
      const missingFields: string[] = [];
      if (!location || location.trim() === '') missingFields.push('location');

      if (missingFields.length > 0) {
        return {
          error: `Missing required fields: ${missingFields.join(', ')}`,
        };
      }

      // Extended mock dining data
      const diningSpots: Dining[] = [
        {
          id: 'DIN001',
          name: 'La Bella Italia',
          type: 'restaurant',
          location,
          pricePerPerson: 65,
          rating: 4.7,
          cuisines: ['Italian', 'Mediterranean'],
          dietaryOptions: ['vegetarian', 'gluten-free'],
          ambiance: 'romantic',
          dressCode: 'smart casual',
          reservations: {
            required: true,
            accepted: true,
            averageWaitTime: '15-20 min'
          },
          hours: {
            monday: '11:30-22:00',
            tuesday: '11:30-22:00',
            wednesday: '11:30-22:00',
            thursday: '11:30-22:00',
            friday: '11:30-23:00',
            saturday: '12:00-23:00',
            sunday: '12:00-21:00'
          },
          distance: { cityCenter: 0.5 },
          priceRange: '$$$',
        },
        {
          id: 'DIN002',
          name: 'Urban Coffee House',
          type: 'cafe',
          location,
          pricePerPerson: 15,
          rating: 4.3,
          cuisines: ['American', 'Cafe'],
          dietaryOptions: ['vegetarian', 'vegan', 'gluten-free'],
          ambiance: 'casual',
          dressCode: 'casual',
          reservations: {
            required: false,
            accepted: false,
            averageWaitTime: '5-10 min'
          },
          hours: {
            monday: '06:30-20:00',
            tuesday: '06:30-20:00',
            wednesday: '06:30-20:00',
            thursday: '06:30-20:00',
            friday: '06:30-22:00',
            saturday: '07:00-22:00',
            sunday: '07:00-18:00'
          },
          distance: { cityCenter: 0.2 },
          priceRange: '$',
        },
        {
          id: 'DIN003',
          name: 'The Sky Bar',
          type: 'bar',
          location,
          pricePerPerson: 45,
          rating: 4.5,
          cuisines: ['American', 'International'],
          dietaryOptions: [],
          ambiance: 'trendy',
          dressCode: 'smart casual',
          reservations: {
            required: false,
            accepted: true,
            averageWaitTime: '20-30 min'
          },
          hours: {
            monday: '16:00-02:00',
            tuesday: '16:00-02:00',
            wednesday: '16:00-02:00',
            thursday: '16:00-02:00',
            friday: '16:00-03:00',
            saturday: '16:00-03:00',
            sunday: '16:00-01:00'
          },
          distance: { cityCenter: 0.1 },
          priceRange: '$$',
        },
        {
          id: 'DIN004',
          name: 'Sakura Sushi House',
          type: 'restaurant',
          location,
          pricePerPerson: 80,
          rating: 4.6,
          cuisines: ['Japanese', 'Asian'],
          dietaryOptions: ['vegetarian'],
          ambiance: 'traditional',
          dressCode: 'casual',
          reservations: {
            required: true,
            accepted: true,
            averageWaitTime: '10-15 min'
          },
          hours: {
            monday: '11:30-14:30, 17:00-22:00',
            tuesday: '11:30-14:30, 17:00-22:00',
            wednesday: '11:30-14:30, 17:00-22:00',
            thursday: '11:30-14:30, 17:00-22:00',
            friday: '11:30-14:30, 17:00-22:30',
            saturday: '12:00-22:30',
            sunday: '12:00-21:00'
          },
          distance: { cityCenter: 2.0 },
          priceRange: '$$$',
        },
        {
          id: 'DIN005',
          name: 'Bistro Provence',
          type: 'restaurant',
          location,
          pricePerPerson: 55,
          rating: 4.4,
          cuisines: ['French', 'European'],
          dietaryOptions: ['vegetarian'],
          ambiance: 'romantic',
          dressCode: 'smart casual',
          reservations: {
            required: true,
            accepted: true,
            averageWaitTime: '15-20 min'
          },
          hours: {
            monday: '11:30-22:00',
            tuesday: '11:30-22:00',
            wednesday: '11:30-22:00',
            thursday: '11:30-22:00',
            friday: '11:30-23:00',
            saturday: '12:00-23:00',
            sunday: '12:00-21:00'
          },
          distance: { cityCenter: 0.8 },
          priceRange: '$$',
        },
        {
          id: 'DIN006',
          name: 'Taco Express',
          type: 'restaurant',
          location,
          pricePerPerson: 12,
          rating: 4.2,
          cuisines: ['Mexican'],
          dietaryOptions: ['vegetarian'],
          ambiance: 'casual',
          dressCode: 'casual',
          reservations: {
            required: false,
            accepted: false,
            averageWaitTime: '10-15 min'
          },
          hours: {
            monday: '11:00-15:00',
            tuesday: '11:00-15:00',
            wednesday: '11:00-15:00',
            thursday: '11:00-15:00',
            friday: '11:00-15:00, 18:00-22:00',
            saturday: '12:00-22:00',
            sunday: '12:00-20:00'
          },
          distance: { cityCenter: 1.2 },
          priceRange: '$',
        },
        {
          id: 'DIN007',
          name: 'Le Grand Maison',
          type: 'fine dining',
          location,
          pricePerPerson: 250,
          rating: 4.9,
          cuisines: ['French', 'International'],
          dietaryOptions: ['vegetarian', 'vegan', 'gluten-free'],
          ambiance: 'formal',
          dressCode: 'formal',
          reservations: {
            required: true,
            accepted: true,
            averageWaitTime: '30-45 min'
          },
          hours: {
            wednesday: '18:00-22:00',
            thursday: '18:00-22:00',
            friday: '18:00-22:00',
            saturday: '18:00-22:00',
            sunday: '18:00-22:00'
          },
          distance: { cityCenter: 3.5 },
          priceRange: '$$$$',
        },
        {
          id: 'DIN008',
          name: 'Spice Garden',
          type: 'restaurant',
          location,
          pricePerPerson: 40,
          rating: 4.5,
          cuisines: ['Indian', 'Asian'],
          dietaryOptions: ['vegetarian', 'vegan', 'gluten-free'],
          ambiance: 'family-friendly',
          dressCode: 'casual',
          reservations: {
            required: false,
            accepted: true,
            averageWaitTime: '15-25 min'
          },
          hours: {
            monday: '11:00-14:30, 17:00-22:00',
            tuesday: '11:00-14:30, 17:00-22:00',
            wednesday: '11:00-14:30, 17:00-22:00',
            thursday: '11:00-14:30, 17:00-22:00',
            friday: '11:00-14:30, 17:00-22:30',
            saturday: '12:00-22:30',
            sunday: '12:00-21:00'
          },
          distance: { cityCenter: 1.8 },
          priceRange: '$$',
        }
      ];

      // Apply filters
      let filtered = diningSpots;

      if (cuisine) {
        filtered = filtered.filter(d => d.cuisines.includes(cuisine));
      }

      if (type) {
        filtered = filtered.filter(d => d.type === type);
      }

      if (minRating) {
        filtered = filtered.filter(d => d.rating >= minRating);
      }

      if (maxPricePerPerson) {
        filtered = filtered.filter(d => d.pricePerPerson <= maxPricePerPerson);
      }

      if (dietaryOptions && dietaryOptions.length > 0) {
        filtered = filtered.filter(d =>
          dietaryOptions.every(option =>
            d.dietaryOptions.some(dopt => dopt.toLowerCase().includes(option.toLowerCase()))
          )
        );
      }

      if (ambiance) {
        filtered = filtered.filter(d => d.ambiance === ambiance);
      }

      if (distanceFromCityCenter) {
        filtered = filtered.filter(d =>
          d.distance?.cityCenter && d.distance.cityCenter <= distanceFromCityCenter
        );
      }

      if (reservationsRequired) {
        filtered = filtered.filter(d => d.reservations.accepted);
      }

      // Sort results
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'rating':
            return b.rating - a.rating;
          case 'price':
            return a.pricePerPerson - b.pricePerPerson;
          case 'distance':
            return (a.distance?.cityCenter || 999) - (b.distance?.cityCenter || 999);
          default:
            return b.rating - a.rating;
        }
      });

      return {
        dining: filtered,
        count: filtered.length,
        guests: guests || 1,
        message: `Found ${filtered.length} dining option(s) in ${location}`,
      };
    }
  }),

  searchVehicles: tool({
    description: 'Search for available rental vehicles with advanced filtering',
    inputSchema: z.object({
      location: z.string().describe('City or rental location'),
      startDate: z.string().describe('Pick-up date in YYYY-MM-DD format'),
      endDate: z.string().describe('Drop-off date in YYYY-MM-DD format'),
      type: z.enum(['sedan', 'suv', 'van', 'sports car', 'luxury', 'compact', 'convertible', 'truck']).optional().describe('Vehicle type'),
      make: z.string().optional().describe('Vehicle make (e.g., Toyota, BMW, Tesla)'),
      capacity: z.number().min(1).max(9).optional().describe('Minimum passenger capacity'),
      fuelType: z.enum(['gasoline', 'diesel', 'electric', 'hybrid']).optional().describe('Preferred fuel type'),
      transmission: z.enum(['automatic', 'manual']).optional().describe('Transmission preference'),
      maxPricePerDay: z.number().optional().describe('Maximum price per day'),
      minRating: z.number().min(1).max(5).optional().describe('Minimum rating (1-5)'),
      features: z.array(z.string()).optional().describe('Required features (GPS, Bluetooth, etc.)'),
      insuranceIncluded: z.boolean().optional().describe('Only show vehicles with included insurance'),
      sortBy: z.enum(['price', 'rating', 'capacity', 'year']).default('price').describe('Sort results by')
    }),
    execute: async ({ location, startDate, endDate, type, make, capacity, fuelType, transmission, maxPricePerDay, minRating, features, insuranceIncluded, sortBy }) => {
      // Validate required fields
      const missingFields: string[] = [];
      if (!location || location.trim() === '') missingFields.push('location');
      if (!startDate || startDate.trim() === '') missingFields.push('startDate');
      if (!endDate || endDate.trim() === '') missingFields.push('endDate');

      if (missingFields.length > 0) {
        return {
          error: true,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missingFields,
          suggestion: `Please ask the user for: ${missingFields.map(f => {
            if (f === 'location') return 'rental location';
            if (f === 'startDate') return 'pick-up date';
            if (f === 'endDate') return 'drop-off date';
            return f;
          }).join(', ')}`,
        };
      }

      // Calculate rental duration
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (days <= 0) {
        return {
          error: true,
          message: 'End date must be after start date',
        };
      }

      // Extended mock vehicle data
      const vehicles: Vehicle[] = [
        {
          id: 'VEH001',
          name: 'Toyota Camry',
          type: 'sedan',
          make: 'Toyota',
          model: 'Camry',
          year: 2024,
          capacity: 5,
          fuelType: 'hybrid',
          transmission: 'automatic',
          color: 'Silver',
          pricePerDay: 45,
          rating: 4.6,
          features: ['GPS', 'Bluetooth', 'Cruise Control', 'Backup Camera', 'Lane Assist'],
          specifications: {
            engine: '2.5L 4-Cylinder Hybrid',
            horsepower: 208,
            mpg: '52 city / 53 highway',
            acceleration: '0-60 in 8.2 sec',
            topSpeed: '125 mph'
          },
          insurance: {
            included: true,
            coverageType: 'Basic liability and collision'
          },
        },
        {
          id: 'VEH002',
          name: 'Tesla Model 3',
          type: 'sedan',
          make: 'Tesla',
          model: 'Model 3',
          year: 2024,
          capacity: 5,
          fuelType: 'electric',
          transmission: 'automatic',
          color: 'White',
          pricePerDay: 120,
          rating: 4.8,
          features: ['GPS', 'Bluetooth', 'Autopilot', 'Premium Audio', 'Full Self-Driving', 'Heated Seats'],
          specifications: {
            engine: 'Electric Motor',
            horsepower: 283,
            mpg: '132 MPGe',
            acceleration: '0-60 in 3.1 sec',
            topSpeed: '140 mph'
          },
          insurance: {
            included: true,
            coverageType: 'Comprehensive coverage'
          },
        },
        {
          id: 'VEH003',
          name: 'BMW X5',
          type: 'luxury',
          make: 'BMW',
          model: 'X5',
          year: 2023,
          capacity: 7,
          fuelType: 'gasoline',
          transmission: 'automatic',
          color: 'Black',
          pricePerDay: 150,
          rating: 4.7,
          features: ['GPS', 'Bluetooth', 'Leather Seats', 'Panoramic Sunroof', 'Heated Seats', 'Premium Sound'],
          specifications: {
            engine: '3.0L Turbocharged 6-Cylinder',
            horsepower: 335,
            mpg: '21 city / 26 highway',
            acceleration: '0-60 in 5.3 sec',
            topSpeed: '130 mph'
          },
          insurance: {
            included: false,
            dailyRate: 25,
            coverageType: 'Optional comprehensive coverage'
          },
        },
        {
          id: 'VEH004',
          name: 'Honda CR-V',
          type: 'suv',
          make: 'Honda',
          model: 'CR-V',
          year: 2024,
          capacity: 5,
          fuelType: 'gasoline',
          transmission: 'automatic',
          color: 'Blue',
          pricePerDay: 55,
          rating: 4.5,
          features: ['GPS', 'Bluetooth', 'All-Wheel Drive', 'Apple CarPlay', 'Android Auto', 'Backup Camera'],
          specifications: {
            engine: '1.5L Turbocharged 4-Cylinder',
            horsepower: 190,
            mpg: '28 city / 34 highway',
            acceleration: '0-60 in 9.0 sec',
            topSpeed: '115 mph'
          },
          insurance: {
            included: true,
            coverageType: 'Basic liability and collision'
          },
        },
        {
          id: 'VEH005',
          name: 'Ford Mustang Convertible',
          type: 'convertible',
          make: 'Ford',
          model: 'Mustang',
          year: 2023,
          capacity: 4,
          fuelType: 'gasoline',
          transmission: 'manual',
          color: 'Red',
          pricePerDay: 95,
          rating: 4.4,
          features: ['GPS', 'Bluetooth', 'Leather Seats', 'Premium Audio', 'Sport Mode', 'Convertible Top'],
          specifications: {
            engine: '5.0L V8',
            horsepower: 450,
            mpg: '15 city / 24 highway',
            acceleration: '0-60 in 4.2 sec',
            topSpeed: '155 mph'
          },
          insurance: {
            included: false,
            dailyRate: 30,
            coverageType: 'Optional comprehensive coverage'
          },
        },
        {
          id: 'VEH006',
          name: 'Chevrolet Silverado',
          type: 'truck',
          make: 'Chevrolet',
          model: 'Silverado',
          year: 2024,
          capacity: 6,
          fuelType: 'gasoline',
          transmission: 'automatic',
          color: 'Gray',
          pricePerDay: 85,
          rating: 4.3,
          features: ['GPS', 'Bluetooth', 'Towing Package', 'Bed Liner', '4WD', 'Trailer Brake'],
          specifications: {
            engine: '5.3L V8',
            horsepower: 355,
            mpg: '16 city / 22 highway',
            acceleration: '0-60 in 7.2 sec',
            topSpeed: '98 mph'
          },
          insurance: {
            included: true,
            coverageType: 'Basic liability and collision'
          },
        },
        {
          id: 'VEH007',
          name: 'Nissan Sentra',
          type: 'compact',
          make: 'Nissan',
          model: 'Sentra',
          year: 2024,
          capacity: 5,
          fuelType: 'gasoline',
          transmission: 'automatic',
          color: 'White',
          pricePerDay: 35,
          rating: 4.2,
          features: ['GPS', 'Bluetooth', 'Apple CarPlay', 'Backup Camera', 'Cruise Control'],
          specifications: {
            engine: '2.0L 4-Cylinder',
            horsepower: 149,
            mpg: '29 city / 39 highway',
            acceleration: '0-60 in 9.5 sec',
            topSpeed: '110 mph'
          },
          insurance: {
            included: true,
            coverageType: 'Basic liability and collision'
          },
        },
        {
          id: 'VEH008',
          name: 'Mercedes-Benz S-Class',
          type: 'luxury',
          make: 'Mercedes-Benz',
          model: 'S-Class',
          year: 2024,
          capacity: 5,
          fuelType: 'gasoline',
          transmission: 'automatic',
          color: 'Black',
          pricePerDay: 250,
          rating: 4.9,
          features: ['GPS', 'Bluetooth', 'Massage Seats', 'Burmester Audio', 'Night Vision', 'Executive Rear Seats'],
          specifications: {
            engine: '3.0L Turbocharged 6-Cylinder',
            horsepower: 429,
            mpg: '20 city / 29 highway',
            acceleration: '0-60 in 4.9 sec',
            topSpeed: '130 mph'
          },
          insurance: {
            included: true,
            coverageType: 'Premium comprehensive coverage'
          },
        }
      ];

      // Apply filters
      let filtered = vehicles;

      if (type) {
        filtered = filtered.filter(v => v.type === type);
      }

      if (make) {
        filtered = filtered.filter(v =>
          v.make.toLowerCase().includes(make.toLowerCase())
        );
      }

      if (capacity) {
        filtered = filtered.filter(v => v.capacity >= capacity);
      }

      if (fuelType) {
        filtered = filtered.filter(v => v.fuelType === fuelType);
      }

      if (transmission) {
        filtered = filtered.filter(v => v.transmission === transmission);
      }

      if (maxPricePerDay) {
        filtered = filtered.filter(v => v.pricePerDay <= maxPricePerDay);
      }

      if (minRating) {
        filtered = filtered.filter(v => v.rating >= minRating);
      }

      if (features && features.length > 0) {
        filtered = filtered.filter(v =>
          features.every(feature =>
            v.features.some(f => f.toLowerCase().includes(feature.toLowerCase()))
          )
        );
      }

      if (insuranceIncluded !== undefined) {
        filtered = filtered.filter(v => v.insurance.included === insuranceIncluded);
      }

      // Sort results
      filtered.sort((a, b) => {
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

      // Calculate total cost for each vehicle
      const vehiclesWithTotal = filtered.map(vehicle => {
        const totalCost = (vehicle.pricePerDay * days) +
          (vehicle.insurance.included ? 0 : (vehicle.insurance.dailyRate || 0) * days);
        return {
          ...vehicle,
          rentalDays: days,
          totalCost: totalCost,
          breakdown: {
            vehicleCost: vehicle.pricePerDay * days,
            insuranceCost: vehicle.insurance.included ? 0 : (vehicle.insurance.dailyRate || 0) * days
          }
        };
      });

      return {
        vehicles: vehiclesWithTotal,
        count: vehiclesWithTotal.length,
        rentalDays: days,
        location,
        message: `Found ${vehiclesWithTotal.length} available vehicle(s) in ${location} for ${days} day(s)`,
      };
    },
  }),

  getWeatherForecast: tool({
    description: 'Get weather forecast for a destination',
    inputSchema: z.object({
      location: z.string().describe('City or location name'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
    }),
    execute: async ({ location, date }) => {
      // Validate required fields
      const missingFields: string[] = [];
      if (!location || location.trim() === '') missingFields.push('location');
      if (!date || date.trim() === '') missingFields.push('date');

      if (missingFields.length > 0) {
        return {
          error: true,
          message: `Missing required fields: ${missingFields.join(', ')}`,
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
  }),
};
