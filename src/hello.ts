import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder, 
  REST, 
  Routes 
} from 'discord.js';
import axios from 'axios';

// ==========================================
// 1. CONFIGURATION & CRASH PREVENTION
// ==========================================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://api-sports.io';
const SEASON = 2025; // Active season code

if (!DISCORD_TOKEN || !API_KEY) {
  console.error('❌ CRITICAL ERROR: Environment variables DISCORD_TOKEN or API_FOOTBALL_KEY are missing!');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

const LEAGUES: Record<string, number> = {
  'Premier League': 39,
  'La Liga': 140,
  'Serie A': 135,
  'Bundesliga': 78,
  'Ligue 1': 61,
  'Champions League': 2
};

const POPULAR_TEAMS = [
  'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Manchester City', 'Manchester United',
  'Liverpool', 'Chelsea', 'Arsenal', 'Tottenham', 'Bayern Munich', 'Borussia Dortmund',
  'PSG', 'Juventus', 'AC Milan', 'Inter', 'Napoli', 'Roma', 'Ajax', 'Benfica', 'Porto'
];

// ==========================================
// 2. SAFE API NETWORK WRAPPER
// ==========================================
const fetchSportsData = async (endpoint: string) => {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: { 'x-apisports-key': API_KEY },
      timeout: 10000
    });
    return response.data?.response || null;
  } catch (error: any) {
    console.error(`[API Network Error] Path: ${endpoint} | ${error.message}`);
    return null;
  }
};

// Helper utility to safely pull team structural profiles from autocomplete lookups
const resolveTeamProfile = async (searchName: string) => {
  const data = await fetchSportsData(`/teams?search=${encodeURIComponent(searchName)}`);
  return data && data.length > 0 ? data[0] : null;
};

// ==========================================
// 3. COMPLETE SLASH COMMAND BUILDER REGISTER
// ==========================================
const commands = [
  new SlashCommandBuilder().setName('live').setDescription('🔴 Live matches right now'),
  new SlashCommandBuilder().setName('table').setDescription('Current league table').addStringOption(o => o.setName('league').setDescription('Choose league').setRequired(true).addChoices(...Object.keys(LEAGUES).map(name => ({ name, value: name })))),
  new SlashCommandBuilder().setName('scorers').setDescription('Top scorers').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('assists').setDescription('Top assists').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('fixtures').setDescription("Today's fixtures"),
  new SlashCommandBuilder().setName('results').setDescription("Yesterday's results"),
  new SlashCommandBuilder().setName('team').setDescription('Team info').addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('player').setDescription('Player stats').addStringOption(o => o.setName('name').setDescription('Player name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('injuries').setDescription('Current injuries').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('next').setDescription('Next 5 matches').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('last').setDescription('Last 5 results').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('trophies').setDescription('Team trophies').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('squad').setDescription('Team squad').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('h2h').setDescription('Head to head').addStringOption(o => o.setName('team1').setDescription('Team 1').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('team2').setDescription('Team 2').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('coach').setDescription('Coach info').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('venue').setDescription('Stadium info').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('transfers').setDescription('Latest transfers').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('predictions').setDescription('Match prediction').addStringOption(o => o.setName('home').setDescription('Home team').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('away').setDescription('Away team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('lineup').setDescription('Live lineup').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('stats').setDescription('Live match stats').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('events').setDescription('Live match events').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('formation').setDescription('Team formation').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('cards').setDescription('Yellow/red cards stats').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('league').setDescription('League details').addStringOption(o => o.setName('name').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands')
].map(c => c.toJSON());

client.once('ready', async () => {
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log(`✅ GoalWire online - Running script: hello.ts`);
  } catch (error) {
    console.error('❌ Failed to push global slash commands:', error);
  }
});

// ==========================================
// 4. INTELLIGENT AUTOCOMPLETE ENGINE
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  try {
    const focused = interaction.options.getFocused(true);
    const value = focused.value.trim().toLowerCase();

    if (['team', 'name', 'team1', 'team2', 'home', 'away'].includes(focused.name)) {
      let choices = POPULAR_TEAMS.filter(t => t.toLowerCase().includes(value));
      
      if (value.length >= 2 && choices.length < 15) {
        const apiData = await fetchSportsData(`/teams?search=${encodeURIComponent(value)}`);
        if (apiData) {
          const extra = apiData.map((t: any) => t.team?.name).filter((n: string) => n && !choices.includes(n));
          choices = [...choices, ...extra];
        }
      }
      return interaction.respond(choices.slice(0, 25).map(c => ({ name: c, value: c })));
    }
  } catch {}
});

// ==========================================
// 5. COMMAND MATRIX HANDLERS
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();
  const cmd = interaction.commandName;

  try {
    // ---- LIVE ----
    if (cmd === 'live') {
      const data = await fetchSportsData('/fixtures?live=all');
      if (!data || !data.length) return interaction.editReply('ℹ️ No live matches are currently active.');
      
      const embed = new EmbedBuilder().setTitle('🔴 LIVE MATCH TRACKER').setColor(0xFF0000);
      data.slice(0, 10).forEach((m: any) => {
        embed.addFields({ 
          name: `${m.teams?.home?.name} ${m.goals?.home ?? 0}-${m.goals?.away ?? 0} ${m.teams?.away?.name}`, 
          value: `🏆 ${m.league?.name || 'Match'} • \`${m.fixture?.status?.elapsed}'\``, 
          inline: false 
        });
      });
      return interaction.editReply({ embeds: [embed] });
    }

    // ---- TABLE ----
    if (cmd === 'table') {
      const name = interaction.options.getString('league', true);
      const id = LEAGUES[name];
      const data = await fetchSportsData(`/standings?league=${id}&season=${SEASON}`);
      const standings = data?.[0]?.league?.standings?.[0];
      
      if (!standings || !standings.length) return interaction.editReply(`❌ Data unavailable for ${name}.`);
      
      const embed = new EmbedBuilder().setTitle(`📊 ${name} Standings`).setColor(0x00FF00);
      let text = '`Pos Team            P   GD  PTS`\n';
      standings.slice(0, 15).forEach((item: any) => {
        const pos = String(item.rank).padEnd(3, ' ');
        const tName = (item.team?.name || 'Unknown').substring(0, 14).padEnd(15, ' ');
