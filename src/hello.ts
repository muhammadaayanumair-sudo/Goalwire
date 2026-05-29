import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import axios from 'axios'
import 'dotenv/config'

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds] 
})

const API_KEY = process.env.API_FOOTBALL_KEY!
const TOKEN = process.env.DISCORD_TOKEN!

// League IDs for API-Football
const LEAGUES = {
  epl: 39,
  laliga: 140,
  bundesliga: 78,
  seriea: 135,
  ligue1: 61,
  ucl: 2
}

// Define commands
const commands = [
  new SlashCommandBuilder()
   .setName('live')
   .setDescription('Show all live matches'),
  
  new SlashCommandBuilder()
   .setName('table')
   .setDescription('Get league table')
   .addStringOption(option =>
      option.setName('league')
       .setDescription('Choose league')
       .setRequired(true)
       .addChoices(
          { name: 'Premier League', value: 'epl' },
          { name: 'La Liga', value: 'laliga' },
          { name: 'Bundesliga', value: 'bundesliga' },
          { name: 'Serie A', value: 'seriea' },
          { name: 'Ligue 1', value: 'ligue1' }
        )
    )
].map(cmd => cmd.toJSON())

// Register commands on startup
const rest = new REST({ version: '10' }).setToken(TOKEN)
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}`)
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands })
    console.log('Slash commands registered')
  } catch (err) {
    console.error(err)
  }
})

// Handle commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return

  // /live command
  if (interaction.commandName === 'live') {
    await interaction.deferReply()
    const res = await axios.get('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: { 'x-apisports-key': API_KEY }
    })
    const matches = res.data.response.slice(0, 10)
    
    if (matches.length === 0) {
      return interaction.editReply('No live matches right now')
    }
    
    const embed = new EmbedBuilder()
     .setTitle('🔴 Live Matches')
     .setColor(0xff0000)
    
    matches.forEach(m => {
      embed.addFields({
        name: `${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}`,
        value: `${m.league.name} | ${m.fixture.status.elapsed}'`,
        inline: false
      })
    })
    
    await interaction.editReply({ embeds: [embed] })
  }

  // /table command - NEW
  if (interaction.commandName === 'table') {
    await interaction.deferReply()
    const league = interaction.options.getString('league')!
    const leagueId = LEAGUES[league]
    
    const res = await axios.get(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=2025`, {
      headers: { 'x-apisports-key': API_KEY }
    })
    
    const standings = res.data.response[0].league.standings[0].slice(0, 10)
    const leagueName = res.data.response[0].league.name
    
    const embed = new EmbedBuilder()
     .setTitle(`📊 ${leagueName} Table`)
     .setColor(0x00ff00)
    
    let desc = '```\nPos Team P W D L Pts\n'
    standings.forEach(team => {
      const t = team.team.name.padEnd(13)
      desc += `${String(team.rank).padStart(2)} ${t} ${team.all.played} ${team.all.win} ${team.all.draw} ${team.all.lose} ${team.points}\n`
    })
    desc += '```'
    
    embed.setDescription(desc)
    await interaction.editReply({ embeds: [embed] })
  }
})

client.login(TOKEN)
