import Axios from 'axios';

// API-Football IDs for the leagues
export const LEAGUES: Record<string, number> = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61
};

// Looks for either naming convention so it accepts your Railway setup automatically!
const apiKey = process.env.FOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY || '';

const apiClient = Axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  timeout: 10000,
  headers: {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'v3.football.api-sports.io'
  }
});

/**
 * Core utility to fetch data from the football API
 */
export async function fetchSportsData(endpoint: string): Promise<any> {
  try {
    if (!apiKey) {
      console.warn('[API Warning] Football API key is missing in your Railway environment variables.');
      return null;
    }
    
    const response = await apiClient.get(endpoint);
    return response.data?.response || null;
  } catch (error: any) {
    console.error(`[API Error] Failed fetching from endpoint: ${endpoint}`, error.message);
    return null;
  }
}