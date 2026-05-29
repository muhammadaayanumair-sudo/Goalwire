import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js'
import axios from 'axios'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)

const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE_URL = 'https://v3.football.api-sports.io'

const LEAGUES = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61,
  'Champions League': 2,
  'Europa League': 3
}

// === HELPERS ===
const get = async (url: string) => {
  try {
    const res = await axios.get(`${BASE_URL}${url}`, { 
      headers: { 'x-apisports-key': API_KEY },
      timeout: 8000 
    })
    return res.data.response
  } catch (err) {
    console.error(`API Error ${url}:`, err.response?.status)
    throw err
  }
}

const getTeamId = async (name: string) => {
  const teams = await get(`/teams?search=${name}`)
  return teams[0]?.team?.id
}

// === 35 COMMANDS ===
const commands = [
  new SlashCommandBuilder().setName('live').setDescription('Show live matches'),
  new SlashCommandBuilder().setName('table').setDescription('League table').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('fixtures').setDescription('Today\'s fixtures'),
  new SlashCommandBuilder().setName('results').setDescription('Yesterday\'s results'),
  new SlashCommandBuilder().setName('team').setDescription('Team info').addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('player').setDescription('Player stats').addStringOption(o => o.setName('name').setDescription('Player name').setRequired(true)),
  new SlashCommandBuilder().setName('scorers').setDescription('Top scorers').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('lineup').setDescription('Match lineups').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true)),
  new SlashCommandBuilder().setName('h2h').setDescription('Head to head').addStringOption(o => o.setName('team1').setDescription('First team').setRequired(true)).addStringOption(o => o.setName('team2').setDescription('Second team').setRequired(true)),
  new SlashCommandBuilder().setName('stats').setDescription('Live match stats').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true)),
  new SlashCommandBuilder().setName('transfers').setDescription('Latest transfers').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('injuries').setDescription('Team injury list').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('predictions').setDescription('Match predictions').addStringOption(o => o.setName('team').setDescription('Team playing today').setRequired(true)),
  new SlashCommandBuilder().setName('coach').setDescription('Coach info').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('trophies').setDescription('Team trophies').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('venue').setDescription('Stadium info').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('formation').setDescription('Most used formation').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('events').setDescription('Live match events').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true)),
  new SlashCommandBuilder().setName('referee').setDescription('Referee stats').addStringOption(o => o.setName('name').setDescription('Referee name').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
  new SlashCommandBuilder().setName('next').setDescription('Team\'s next 5 matches').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('last').setDescription('Team\'s last 5 results').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('squad').setDescription('Team squad').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('comparison').setDescription('Compare 2 teams').addStringOption(o => o.setName('team1').setDescription('First team').setRequired(true)).addStringOption(o => o.setName('team2').setDescription('Second team').setRequired(true)),
  new SlashCommandBuilder().setName('league').setDescription('League info').addStringOption(o => o.setName('name').setDescription('League name').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('countries').setDescription('List countries'),
  new SlashCommandBuilder().setName('seasons').setDescription('Available seasons').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('bracket').setDescription('Cup bracket').addStringOption(o => o.setName('league').setDescription('Cup name').setRequired(true).addChoices({ name: 'Champions League', value: 'Champions League' }, { name: 'Europa League', value: 'Europa League' })),
  new SlashCommandBuilder().setName('subscribe').setDescription('Get goal alerts for a team').addStringOption(o => o.setName('
