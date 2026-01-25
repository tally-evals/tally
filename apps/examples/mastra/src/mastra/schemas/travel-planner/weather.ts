import { z } from 'zod';

export const getWeatherForecastParamsSchema = z.object({
  location: z.string().describe('City or location name'),
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

export const weatherForecastSchema = z.object({
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
});

export type GetWeatherForecastParams = z.infer<typeof getWeatherForecastParamsSchema>;
export type WeatherForecast = z.infer<typeof weatherForecastSchema>;


