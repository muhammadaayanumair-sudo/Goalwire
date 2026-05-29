import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js'
import axios from 'axios'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE_URL = 'https://v3.football.api-sports.io'

const SEASON = 2025 // Current season 2025/26

const LEAGUES: Record<string, number> = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61,
  'Champions League': 2
}

const POPULAR_TEAMS = [
  'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Manchester City', 'Manchester United',
  'Liverpool', 'Chelsea', 'Arsenal', 'Tottenham', 'Bayern Munich', 'Borussia Dortmund',
  'PSG', 'Juventus', 'AC Milan', 'Inter', 'Napoli', 'Roma', 'Ajax', 'Benfica', 'Porto',
  'Brazil', 'Argentina', 'France', 'England', 'Spain', 'Germany', 'Portugal', 'Italy'
]

const cache = new Map<string, { data: any; time: number }>()
const get = async (url: string, ttl = 180) => {
  const key = url
  const cached = cache.get(key)
  if (cached && Date.now() - cached.time < ttl * 1000) return cached.data

  try {
    const res = await axios.get(`${BASE_URL}${url}`, {
      headers: { 'x-apisports-key': API_KEY },
      timeout: 10000
    })
    const data = res.data.response
    cache.set(key, { data, time: Date.now() })
    return data
  } catch (e: any) {
    if (e.response?.status === 429) throw new Error('RATE_LIMIT')
    if (e.response?.status === 403) throw new Error('BAD_KEY')
    throw new Error('API_FAIL')
  }
}

const getTeamId = async (name: string) => {
  const teams = await get(`/teams?search=${encodeURIComponent(name)}`, 3600)
  return teams?.[0]?.team?.id
}

// === ALL 25 COMMANDS ===
const commands = [
  new SlashCommandBuilder().setName('live').setDescription('🔴 Live matches now'),
  new SlashCommandBuilder().setName('table').setDescription('League table').addStringOption(o => o.setName('league').setDescription('Choose league').setRequired(true).addChoices(...Object.entries(LEAGUES).map(([name]) => ({ name, value: name })))),
  new SlashCommandBuilder().setName('scorers').setDescription('Top scorers').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('assists').setDescription('Top assists').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('fixtures').setDescription('Today fixtures'),
  new SlashCommandBuilder().setName('results').setDescription('Yesterday results'),
  new SlashCommandBuilder().setName('team').setDescription('Team info').addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('player').setDescription('Player stats').addStringOption(o => o.setName('name').setDescription('Player name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('squad').setDescription('Team squad').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('trophies').setDescription('Team trophies').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('next').setDescription('Next 5
