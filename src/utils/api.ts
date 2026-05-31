import Axios from 'axios';

// API-Football IDs for the major tracked leagues
export const LEAGUES: Record<string, number> = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61
};

// Automatically attempts to fall back to your custom variable name configuration
const apiKey = process.env.FOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY || '';

const apiClient = Axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  timeout: 10000, // Blocks long API hangs from freezing your discord commands
  headers: {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'v3.football.api-sports.io'
  }
});

/**
 * Core secure utility to fetch live data matrix allocations
 */
export async function fetchSportsData(endpoint: string): Promise<any> {
  try {
    if (!apiKey) {
      console.warn('[API Warning] Football API key environment variable is completely missing.');
      return null;
    }
    
    const response = await apiClient.get(endpoint);
    return response.data?.response || null;
  } catch (error: any) {
    console.error(`[API Error] Failed fetching data connection point: ${endpoint}`, error.message);
    return null;
  }
}