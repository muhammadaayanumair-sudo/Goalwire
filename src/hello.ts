import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, TextChannel } from 'discord.js'
import 'dotenv/config'
import axios from 'axios'

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

const API_KEY = process.env.API_FOOTBALL_KEY || ''
const API_HOST = 'v3.football.api-sports.io'

const api = axios.create({
  baseURL: `https://${API_HOST}`,
  headers: { 'x-apisports-key': API_KEY }
})

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`)
  registerCommands()
  startAutoPosting()
})

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('live').setDescription('Show all live matches'),
    new SlashCommandBuilder().setName('score').setDescription('Get live score for a team')
     .addStringOption(opt => opt.setName('team').setDescription('Team name').setRequired(true)),
    new SlashCommandBuilder().setName('fixtures').setDescription('Today\'s fixtures'),
    new SlashCommandBuilder().setName('table').setDescription('League standings')
     .addStringOption(opt => opt.setName('league').setDescription('Premier League, La Liga, etc').setRequired(true))
  ].map(cmd => cmd.toJSON())

  await client.application?.commands.set(commands)
  console.log('Slash commands registered')
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction
  await interaction.deferReply()

  try {
    if (commandName === 'live') {
      const { data } = await api.get('/fixtures', { params: { live: 'all' } })
      if (!data.response.length) return interaction.editReply('No live matches right now.')
      
      const embed = new EmbedBuilder()
       .setTitle('🔴 Live Matches')
       .setColor(0xFF0000)
       .setDescription(data.response.slice(0, 10).map((m: any) => 
          `**${m.teams.home.name}** ${m.goals.home} - ${m.goals.away} **${m.teams.away.name}** (${m.fixture.status.elapsed}')`
        ).join('\n'))
      
      await interaction.editReply({ embeds: [embed] })
    }

    if (commandName === 'score') {
      const team = interaction.options.getString('team', true)
      const { data } = await api.get('/fixtures', { params: { live: 'all' } })
      const match = data.response.find((m: any) => 
        m.teams.home.name.toLowerCase().includes(team.toLowerCase()) || 
        m.teams.away.name.toLowerCase().includes(team.toLowerCase())
      )
      
      if (!match) return interaction.editReply(`No live match found for ${team}`)
      
      const embed = new EmbedBuilder()
       .setTitle(`${match.teams.home.name} vs ${match.teams.away.name}`)
       .setDescription(`**${match.goals.home} - ${match.goals.away}** | ${match.fixture.status.elapsed}'`)
       .setColor(0x00FF00)
       .setFooter({ text: match.league.name })
      
      await interaction.editReply({ embeds: [embed] })
    }

    if (commandName === 'fixtures') {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await api.get('/fixtures', { params: { date: today } })
      if (!data.response.length) return interaction.editReply('No fixtures today.')
      
      const embed = new EmbedBuilder()
       .setTitle(`📅 Today's Fixtures`)
       .setColor(0x0099FF)
       .setDescription(data.response.slice(0, 15).map((m: any) => 
          `${m.teams.home.name} vs ${m.teams.away.name} - ${m.fixture.status.short}`
        ).join('\n'))
      
      await interaction.editReply({ embeds: [embed] })
    }

    if (commandName === 'table') {
      const leagueName = interaction.options.getString('league', true)
      const leagues: any = { 'premier league': 39, 'la liga': 140, 'bundesliga': 78, 'serie a': 135, 'ligue 1': 61 }
      const leagueId = leagues[leagueName.toLowerCase()]
      if (!leagueId) return interaction.editReply('League not found. Try: Premier League, La Liga, Bundesliga, Serie A, Ligue 1')
      
      const season = new Date().getFullYear()
      const { data } = await api.get('/standings', { params: { league: leagueId, season } })
      const standings = data.response[0].league.standings[0].slice(0, 10)
      
      const embed = new EmbedBuilder()
       .setTitle(`${data.response[0].league.name} Table`)
       .setColor(0xFFD700)
       .setDescription(standings.map((t: any) => 
          `**${t.rank}.** ${t.team.name} - ${t.points} pts`
        ).join('\n'))
      
      await interaction.editReply({ embeds: [embed] })
    }
  } catch (err) {
    console.error(err)
    await interaction.editReply('Error fetching data. Check your API key.')
  }
})

// Auto-posting: Check for goals + FT every 60s
const postedEvents = new Set()

async function startAutoPosting() {
  const channelId = process.env.ALERTS_CHANNEL_ID
  if (!channelId) return console.log('No ALERTS_CHANNEL_ID set. Skipping auto-posts.')
  
  setInterval(async () => {
    try {
      const { data } = await api.get('/fixtures', { params: { live: 'all' } })
      const channel = await client.channels.fetch(channelId) as TextChannel
      
      for (const match of data.response) {
        // Goal alerts
        for (const event of match.events || []) {
          if (event.type === 'Goal' &&!postedEvents.has(event.id)) {
            postedEvents.add(event.id)
            const embed = new EmbedBuilder()
             .setTitle('⚽ GOAL!')
             .setDescription(`**${event.player.name}** (${event.team.name}) ${match.goals.home}-${match.goals.away}`)
             .setColor(0x00FF00)
             .setFooter({ text: `${match.teams.home.name} vs ${match.teams.away.name}` })
            await channel.send({ embeds: [embed] })
          }
        }
        // Full-time results
        if (match.fixture.status.short === 'FT' &&!postedEvents.has(`ft-${match.fixture.id}`)) {
          postedEvents.add(`ft-${match.fixture.id}`)
          const embed = new EmbedBuilder()
           .setTitle('🏁 Full Time')
           .setDescription(`**${match.teams.home.name} ${match.goals.home} - ${match.goals.away} ${match.teams.away.name}**`)
           .setColor(0x0099FF)
           .setFooter({ text: match.league.name })
          await channel.send({ embeds: [embed] })
        }
      }
    } catch (err) {
      console.error('Auto-post error:', err)
    }
  }, 60000) // Check every 60 seconds
}

client.login(process.env.DISCORD_TOKEN)
