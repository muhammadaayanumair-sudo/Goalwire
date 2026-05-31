import Axios from 'axios';

// API-Football IDs for the 2025/2026 seasons
export const LEAGUES: Record<string, number> = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61
};

const apiClient = Axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  timeout: 10000,
  headers: {
    'x-rapidapi-key': process.env.FOOTBALL_API_KEY || '',
    'x-rapidapi-host': 'v3.football.api-sports.io'
  }
});

/**
 * Core utility to fetch data from the football API
 * @param endpoint The API path (e.g., '/fixtures?live=all')
 */
export async function fetchSportsData(endpoint: string): Promise<any> {
  try {
    if (!process.env.FOOTBALL_API_KEY) {
      console.warn('[API Warning] FOOTBALL_API_KEY is missing in your environment variables.');
    }
    
    const response = await apiClient.get(endpoint);
    
    // API-Sports wraps its data arrays inside a "response" property
    return response.data?.response || null;
  } catch (error: any) {
    console.error(`[API Error] Failed fetching from endpoint: ${endpoint}`, error.message);
    return null;
  }
}