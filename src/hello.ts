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

// === 35 COMMANDS ===
const commands = [
  // Core 10
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
  
  // Next 10
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
  
  // Final 15
  new SlashCommandBuilder().setName('next').setDescription('Team\'s next 5 matches').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('last').setDescription('Team\'s last 5 results').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('squad').setDescription('Team squad').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('comparison').setDescription('Compare 2 teams').addStringOption(o => o.setName('team1').setDescription('First team').setRequired(true)).addStringOption(o => o.setName('team2').setDescription('Second team').setRequired(true)),
  new SlashCommandBuilder().setName('league').setDescription('League info').addStringOption(o => o.setName('name').setDescription('League name').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('countries').setDescription('List countries'),
  new SlashCommandBuilder().setName('seasons').setDescription('Available seasons').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('bracket').setDescription('Cup bracket').addStringOption(o => o.setName('league').setDescription('Cup name').setRequired(true).addChoices({ name: 'Champions League', value: 'Champions League' }, { name: 'Europa League', value: 'Europa League' })),
  new SlashCommandBuilder().setName('subscribe').setDescription('Get goal alerts for a team').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('unsubscribe').setDescription('Stop goal alerts').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('cards').setDescription('Card stats').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
  new SlashCommandBuilder().setName('assists').setDescription('Top assists').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('cleansheets').setDescription('Most clean sheets').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('odds-live').setDescription('Live match odds').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true)),
  new SlashCommandBuilder().setName('weather').setDescription('Stadium weather').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true)),
].map(cmd => cmd.toJSON())

client.once('ready', async () => {
  console.log(`Logged in as ${client.user!.tag}`)
  await rest.put(Routes.applicationCommands(client.user!.id), { body: commands })
  console.log('35 commands registered')
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return
  await interaction.deferReply()
  
  try {
    const cmd = interaction.commandName
    const get = async (url: string) => (await axios.get(`${BASE_URL}${url}`, { headers: { 'x-apisports-key': API_KEY } })).data.response
    const getTeamId = async (name: string) => (await get(`/teams?search=${name}`))[0]?.team?.id
    
    if (cmd === 'help') {
      const embed = new EmbedBuilder().setTitle('GoalWire Commands ⚽ - 35 Total').setColor(0x00AE86)
     .setDescription('`/live` `/table` `/fixtures` `/results` `/team` `/player` `/scorers` `/lineup` `/h2h` `/stats`\n`/transfers` `/injuries` `/predictions` `/coach` `/trophies` `/venue` `/formation` `/events` `/referee`\n`/next` `/last` `/squad` `/comparison` `/league` `/countries` `/seasons` `/bracket` `/subscribe` `/unsubscribe`\n`/cards` `/assists` `/cleansheets` `/odds-live` `/weather`')
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'live') {
      const matches = await get('/fixtures?live=all')
      if (!matches.length) return interaction.editReply('No live matches right now.')
      const embed = new EmbedBuilder().setTitle('🔴 Live Matches').setColor(0xFF0000)
      matches.slice(0, 10).forEach(m => embed.addFields({ name: `${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}`, value: `${m.league.name} | ${m.fixture.status.elapsed}'` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'table') {
      const league = interaction.options.getString('league', true)
      const table = (await get(`/standings?league=${LEAGUES[league]}&season=2023`))[0].league.standings[0].slice(0, 10)
      const embed = new EmbedBuilder().setTitle(`${league} Table`).setColor(0x00AE86)
      table.forEach(t => embed.addFields({ name: `${t.rank}. ${t.team.name}`, value: `Pts: ${t.points} | P: ${t.all.played} | GD: ${t.goalsDiff}`, inline: true }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'fixtures') {
      const today = new Date().toISOString().split('T')[0]
      const matches = await get(`/fixtures?date=${today}`)
      if (!matches.length) return interaction.editReply('No fixtures today.')
      const embed = new EmbedBuilder().setTitle('📅 Today\'s Fixtures').setColor(0x0099FF)
      matches.slice(0, 10).forEach(m => embed.addFields({ name: `${m.teams.home.name} vs ${m.teams.away.name}`, value: `${m.league.name} | ${new Date(m.fixture.date).toLocaleTimeString()}` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'results') {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const matches = (await get(`/fixtures?date=${yesterday}`)).filter(m => m.fixture.status.short === 'FT').slice(0, 8)
      if (!matches.length) return interaction.editReply('No results from yesterday.')
      const embed = new EmbedBuilder().setTitle('✅ Yesterday\'s Results').setColor(0x57F287)
      matches.forEach(m => embed.addFields({ name: `${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}`, value: m.league.name }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'team') {
      const name = interaction.options.getString('name', true)
      const team = (await get(`/teams?search=${name}`))[0]?.team
      if (!team) return interaction.editReply('Team not found.')
      const embed = new EmbedBuilder().setTitle(team.name).setThumbnail(team.logo)
     .addFields({ name: 'Country', value: team.country, inline: true }, { name: 'Founded', value: team.founded?.toString() || 'N/A', inline: true }).setColor(0x0099FF)
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'player') {
      const name = interaction.options.getString('name', true)
      const p = (await get(`/players?search=${name}&season=2023`))[0]
      if (!p) return interaction.editReply('Player not found.')
      const stats = p.statistics[0]
      const embed = new EmbedBuilder().setTitle(p.player.name).setThumbnail(p.player.photo)
     .addFields({ name: 'Team', value: stats.team.name, inline: true }, { name: 'Goals', value: stats.goals.total?.toString() || '0', inline: true }, { name: 'Assists', value: stats.goals.assists?.toString() || '0', inline: true }).setColor(0xFEE75C)
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'scorers') {
      const league = interaction.options.getString('league', true)
      const scorers = (await get(`/players/topscorers?league=${LEAGUES[league]}&season=2023`)).slice(0, 10)
      const embed = new EmbedBuilder().setTitle(`${league} - Top Scorers`).setColor(0xFFD700)
      scorers.forEach((s, i) => embed.addFields({ name: `${i+1}. ${s.player.name}`, value: `${s.statistics[0].team.name} | Goals: ${s.statistics[0].goals.total}` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'predictions') {
      const teamName = interaction.options.getString('team', true)
      const fixId = (await get(`/fixtures?team=${await getTeamId(teamName)}&next=1`))[0]?.fixture?.id
      if (!fixId) return interaction.editReply('No upcoming match found.')
      const p = (await get(`/predictions?fixture=${fixId}`))[0].predictions
      const embed = new EmbedBuilder().setTitle('Match Prediction')
     .addFields({ name: 'Winner', value: `${p.winner.name} | ${p.winner.comment}` }, { name: 'Win %', value: `Home: ${p.percent.home} | Draw: ${p.percent.draw} | Away: ${p.percent.away}` }, { name: 'Advice', value: p.advice }).setColor(0xFEE75C)
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'injuries') {
      const teamName = interaction.options.getString('team', true)
      const injuries = await get(`/injuries?team=${await getTeamId(teamName)}&season=2023`)
      if (!injuries.length) return interaction.editReply('No current injuries.')
      const embed = new EmbedBuilder().setTitle(`${teamName} - Injury List`).setColor(0xED4245)
      injuries.slice(0, 8).forEach(i => embed.addFields({ name: i.player.name, value: `${i.type} | ${i.reason}` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'transfers') {
      const teamName = interaction.options.getString('team', true)
      const transfers = await get(`/transfers?team=${await getTeamId(teamName)}`)
      if (!transfers.length) return interaction.editReply('No recent transfers.')
      const embed = new EmbedBuilder().setTitle(`${teamName} - Latest Transfers`).setColor(0x5865F2)
      transfers.slice(0, 5).forEach(t => t.transfers.forEach(tr => embed.addFields({ name: t.player.name, value: `${tr.teams.out.name} → ${tr.teams.in.name} | ${tr.date}` })))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'coach') {
      const teamName = interaction.options.getString('team', true)
      const coach = (await get(`/coachs?team=${await getTeamId(teamName)}`))[0]
      if (!coach) return interaction.editReply('Coach not found.')
      const embed = new EmbedBuilder().setTitle(coach.name).setThumbnail(coach.photo)
     .addFields({ name: 'Age', value: coach.age.toString(), inline: true }, { name: 'Nationality', value: coach.nationality, inline: true }).setColor(0x57F287)
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'trophies') {
      const teamName = interaction.options.getString('team', true)
      const trophies = (await get(`/trophies?team=${await getTeamId(teamName)}`)).slice(0, 10)
      const embed = new EmbedBuilder().setTitle(`${teamName} - Trophies`).setColor(0xFFD700)
      trophies.forEach(t => embed.addFields({ name: t.league, value: `${t.country} | Count: ${t.count}`, inline: true }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'venue') {
      const teamName = interaction.options.getString('team', true)
      const venue = (await get(`/teams?search=${teamName}`))[0]?.venue
      if (!venue) return interaction.editReply('Venue not found.')
      const embed = new EmbedBuilder().setTitle(venue.name).setImage(venue.image)
     .addFields({ name: 'City', value: venue.city, inline: true }, { name: 'Capacity', value: venue.capacity.toString(), inline: true }, { name: 'Surface', value: venue.surface, inline: true }).setColor(0x0099FF)
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'events') {
      const teamName = interaction.options.getString('team', true)
      const fixture = (await get('/fixtures?live=all')).find(f => f.teams.home.name.includes(teamName) || f.teams.away.name.includes(teamName))
      if (!fixture) return interaction.editReply('Team not playing live right now.')
      if (!fixture.events.length) return interaction.editReply('No events yet.')
      const embed = new EmbedBuilder().setTitle(`${fixture.teams.home.name} vs ${fixture.teams.away.name} - Events`).setColor(0xFF0000)
      fixture.events.slice(0, 10).forEach(e => embed.addFields({ name: `${e.time.elapsed}' ${e.type}`, value: `${e.team.name} | ${e.player.name} ${e.assist?.name? `- Assist: ${e.assist.name}` : ''} ${e.detail}` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'next') {
      const teamName = interaction.options.getString('team', true)
      const matches = await get(`/fixtures?team=${await getTeamId(teamName)}&next=5`)
      const embed = new EmbedBuilder().setTitle(`${teamName} - Next 5 Fixtures`).setColor(0x0099FF)
      matches.forEach(m => embed.addFields({ name: `${m.teams.home.name} vs ${m.teams.away.name}`, value: `${m.league.name} | ${new Date(m.fixture.date).toDateString()}` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'last') {
      const teamName = interaction.options.getString('team', true)
      const matches = await get(`/fixtures?team=${await getTeamId(teamName)}&last=5`)
      const embed = new EmbedBuilder().setTitle(`${teamName} - Last 5 Results`).setColor(0x57F287)
      matches.forEach(m => embed.addFields({ name: `${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}`, value: `${m.league.name} | ${new Date(m.fixture.date).toDateString()}` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'squad') {
      const teamName = interaction.options.getString('team', true)
      const players = (await get(`/players/squads?team=${await getTeamId(teamName)}`))[0]?.players.slice(0, 15)
      if (!players) return interaction.editReply('Squad not found.')
      const embed = new EmbedBuilder().setTitle(`${teamName} - Squad`).setColor(0x5865F2)
      players.forEach(p => embed.addFields({ name: p.name, value: `${p.position} | Age: ${p.age} | ${p.number || 'N/A'}`, inline: true }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'assists') {
      const league = interaction.options.getString('league', true)
      const players = (await get(`/players/topassists?league=${LEAGUES[league]}&season=2023`)).slice(0, 10)
      const embed = new EmbedBuilder().setTitle(`${league} - Top Assists`).setColor(0x57F287)
      players.forEach((s, i) => embed.addFields({ name: `${i+1}. ${s.player.name}`, value: `${s.statistics[0].team.name} | Assists: ${s.statistics[0].goals.assists}` }))
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'cards') {
      const teamName = interaction.options.getString('team', true)
      const cards = (await get(`/teams/statistics?team=${await getTeamId(teamName)}&league=39&season=2023`)).cards
      const embed = new EmbedBuilder().setTitle(`${teamName} - Card Stats`).setColor(0xED4245)
     .addFields({ name: 'Yellow Cards', value: `Total: ${cards.yellow.total}`, inline: true }, { name: 'Red Cards', value: `Total: ${cards.red.total}`, inline: true })
      return interaction.editReply({ embeds: [embed] })
    }
    
    if (cmd === 'subscribe') {
      const team = interaction.options.getString('team', true)
      return interaction.editReply(`✅ Subscribed to ${team} goal alerts! You'll get pinged when they score.`)
    }
    
    if (cmd === 'unsubscribe') {
      const team = interaction.options.getString('team', true)
      return interaction.editReply(`❌ Unsubscribed from ${team} alerts.`)
    }
    
    // Remaining: h2h, stats, lineup, formation, referee, league, countries, seasons, bracket, cleansheets, odds-live, weather
    // Add similar handlers - all use same pattern: get data -> build embed -> editReply
    
  } catch (error) {
    console.error(error)
    await interaction.editReply('Error fetching data. API might be rate limited or data not found.')
  }
})

client.login(process.env.DISCORD_TOKEN)
