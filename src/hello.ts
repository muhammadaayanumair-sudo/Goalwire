import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js'
import axios from 'axios'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE_URL = 'https://v3.football.api-sports.io'

const SEASON = 2025

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
  'PSG', 'Juventus', 'AC Milan', 'Inter', 'Napoli', 'Roma', 'Ajax', 'Benfica', 'Porto'
]

const get = async (url: string) => {
  try {
    const res = await axios.get(`${BASE_URL}${url}`, {
      headers: { 'x-apisports-key': API_KEY },
      timeout: 10000
    })
    return res.data.response
  } catch (error) {
    console.error(`API Error on ${url}:`, error)
    return null
  }
}

const commands = [
  new SlashCommandBuilder().setName('live').setDescription('🔴 Live matches right now'),
  new SlashCommandBuilder().setName('table').setDescription('Current league table 2025/26').addStringOption(o => o.setName('league').setDescription('Choose league').setRequired(true).addChoices(...Object.keys(LEAGUES).map(name => ({ name, value: name })))),
  new SlashCommandBuilder().setName('scorers').setDescription('Top scorers 2025/26').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('assists').setDescription('Top assists 2025/26').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('fixtures').setDescription('Today\'s fixtures'),
  new SlashCommandBuilder().setName('results').setDescription('Yesterday\'s results'),
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
  new SlashCommandBuilder().setName('cards').setDescription('Yellow/red cards 2025/26').addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('league').setDescription('League info').addStringOption(o => o.setName('name').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(n => ({ name: n, value: n })))),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands')
].map(c => c.toJSON())

client.once('ready', async () => {
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands })
    console.log(`✅ GoalWire online - Season ${SEASON}/${SEASON+1}`)
  } catch (error) {
    console.error('Error registering application commands:', error)
  }
})

client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused(true)
    const value = focused.value.toLowerCase()

    if (['team', 'name', 'team1', 'team2', 'home', 'away'].includes(focused.name)) {
      let choices = POPULAR_TEAMS.filter(t => t.toLowerCase().includes(value))
      if (value.length >= 2 && choices.length < 20) {
        try {
          const api = await get(`/teams?search=${encodeURIComponent(value)}`)
          if (api) {
            const extra = api.map((t: any) => t.team.name).filter((n: string) => !choices.includes(n))
            choices = [...choices, ...extra]
          }
        } catch {}
      }
      return interaction.respond(choices.slice(0, 25).map(c => ({ name: c, value: c })))
    }

    if (focused.name === 'name' && interaction.commandName === 'player') {
      if (value.length < 3) return interaction.respond([])
      try {
        const players = await get(`/players?search=${encodeURIComponent(value)}&season=${SEASON}`)
        if (!players) return interaction.respond([])
        const choices = players.slice(0, 25).map((p: any) => ({
          name: `${p.player.name} - ${p.statistics[0]?.team?.name || 'Unknown'}`,
          value: p.player.name
        }))
        return interaction.respond(choices)
      } catch {
        return interaction.respond([])
      }
    }
  }

  if (!interaction.isChatInputCommand()) return
  await interaction.deferReply()

  const cmd = interaction.commandName

  try {
    if (cmd === 'live') {
      const matches = await get('/fixtures?live=all')
      if (!matches || !matches.length) return interaction.editReply('No live matches right now')
      
      const embed = new EmbedBuilder().setTitle('🔴 LIVE NOW').setColor(0xFF0000)
      matches.slice(0, 10).forEach((m: any) => {
        embed.addFields({ 
          name: `${m.teams.home.name} ${m.goals.home ?? 0}-${m.goals.away ?? 0} ${m.teams.away.name}`, 
          value: `${m.league.name} • ${m.fixture.status.elapsed}'`, 
          inline: false 
        })
      })
      return interaction.editReply({ embeds: [embed] })
    }

    if (cmd === 'table') {
      const leagueName = interaction.options.getString('league', true)
      const leagueId = LEAGUES[leagueName]
      
      const data = await get(`/standings?league=${leagueId}&season=${SEASON}`)
      if (!data || !data[0]?.league?.standings?.[0]) return interaction.editReply('Could not fetch standings table data.')
      
      const standings = data[0].league.standings[0]
      const embed = new EmbedBuilder().setTitle(`📊 ${leagueName} Standings ${SEASON}/${SEASON+1}`).setColor(0x00FF00)
      
      let tableText = '`Pos Team            P   GD  PTS`\n'
      standings.slice(0, 15).forEach((teamData: any) => {
        const pos = String(teamData.rank).padEnd(3, ' ')
        const name = teamData.team.name.substring(0, 15).padEnd(15, ' ')
        const played = String(teamData.all.played).padEnd(3, ' ')
        const gd = String(teamData.goalsDiff).padEnd(4, ' ')
        const pts = String(teamData.points)
        tableText += `\`${pos}${name}${played}${gd}${pts}\`\n`
      })
      
      embed.setDescription(tableText)
      return interaction.editReply({ embeds: [embed] })
    }

    // Catch-all handler for commands you haven't fully written yet
    return interaction.editReply(`🚧 The \`/${cmd}\` command infrastructure is valid, but full data rendering logic is not written yet!`)

  } catch (error) {
    console.error('Command Execution Error:', error)
    return interaction.editReply('❌ An error occurred while processing this command.')
  }
})

client.login(process.env.DISCORD_TOKEN)
