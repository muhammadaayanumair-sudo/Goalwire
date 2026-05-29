import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js'
import axios from 'axios'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!)
const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE_URL = 'https://v3.football.api-sports.io'

const LEAGUES = { 'Premier League': 39, 'La Liga': 140, 'Serie A': 135, 'Bundesliga': 78, 'Ligue 1': 61, 'Champions League': 2 }

const POPULAR_TEAMS = [
  'Real Madrid', 'Barcelona', 'Manchester United', 'Manchester City', 'Liverpool', 'Chelsea', 'Arsenal', 'Tottenham',
  'Bayern Munich', 'Borussia Dortmund', 'PSG', 'Juventus', 'AC Milan', 'Inter', 'Napoli', 'Atletico Madrid',
  'Brazil', 'Argentina', 'France', 'Germany', 'England', 'Spain', 'Italy', 'Portugal'
]

const cache = new Map()
const get = async (url: string, ttl = 300) => {
  const key = url; const c = cache.get(key)
  if (c && Date.now() - c.time < ttl * 1000) return c.data
  try {
    const r = await axios.get(`${BASE_URL}${url}`, { headers: { 'x-apisports-key': API_KEY }, timeout: 10000 })
    cache.set(key, { data: r.data.response, time: Date.now() })
    return r.data.response
  } catch (e: any) {
    console.error('API Error:', e.response?.status, e.response?.data)
    if (e.response?.status === 429) throw new Error('RATE_LIMIT')
    if (e.response?.status === 403) throw new Error('INVALID_KEY')
    throw new Error('API_ERROR')
  }
}

const getTeamId = async (name: string) => {
  const teams = await get(`/teams?search=${encodeURIComponent(name)}`, 3600)
  return teams?.[0]?.team?.id
}

const commands = [
  new SlashCommandBuilder().setName('live').setDescription('Live matches'),
  new SlashCommandBuilder().setName('table').setDescription('League table').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('scorers').setDescription('Top scorers').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('assists').setDescription('Top assists').addStringOption(o => o.setName('league').setDescription('League').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('fixtures').setDescription('Today fixtures'),
  new SlashCommandBuilder().setName('results').setDescription('Yesterday results'),
  new SlashCommandBuilder().setName('team').setDescription('Team info').addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('player').setDescription('Player stats').addStringOption(o => o.setName('name').setDescription('Player name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('squad').setDescription('Team squad').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('trophies').setDescription('Team trophies').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('next').setDescription('Next 5 matches').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('last').setDescription('Last 5 results').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('h2h').setDescription('Head to head').addStringOption(o => o.setName('team1').setDescription('First team').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('team2').setDescription('Second team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('injuries').setDescription('Team injuries').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('transfers').setDescription('Latest transfers').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('coach').setDescription('Coach info').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('venue').setDescription('Stadium info').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('predictions').setDescription('Match prediction').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('lineup').setDescription('Live lineup').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('stats').setDescription('Live match stats').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('events').setDescription('Live match events').addStringOption(o => o.setName('team').setDescription('Team playing now').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('formation').setDescription('Team formations').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('cards').setDescription('Card statistics').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('league').setDescription('League info').addStringOption(o => o.setName('name').setDescription('League name').setRequired(true).addChoices(...Object.keys(LEAGUES).map(l => ({ name: l, value: l })))),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands')
].map(c => c.toJSON())

client.once('ready', async () => {
  console.log(`✅ GoalWire online`);
  await rest.put(Routes.applicationCommands(client.user!.id), { body: commands })
})

// AUTOCOMPLETE
client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused().toLowerCase()
    const commandName = interaction.commandName
    const optionName = interaction.options.getFocused(true).name

    // Team autocomplete for any option named 'team', 'name', 'team1', 'team2'
    if (['team', 'name', 'team1', 'team2'].includes(optionName) && ['team', 'squad', 'trophies', 'next', 'last', 'h2h', 'injuries', 'transfers', 'coach', 'venue', 'predictions', 'lineup', 'stats', 'events', 'formation', 'cards'].includes(commandName)) {
      let choices = POPULAR_TEAMS.filter(t => t.toLowerCase().includes(focused)).slice(0, 25)
      if (focused.length >= 3 && choices.length < 25) {
        try {
          const apiTeams = await get(`/teams?search=${encodeURIComponent(focused)}`, 3600)
          const extra = apiTeams.map((t: any) => t.team.name).filter((n: string) =>!choices.includes(n)).slice(0, 25 - choices.length)
          choices = [...choices,...extra]
        } catch {}
      }
      return interaction.respond(choices.map(c => ({ name: c, value: c })))
    }

    // Player autocomplete
    if (commandName === 'player' && optionName === 'name') {
      if (focused.length < 3) return interaction.respond([])
      try {
        const players = await get(`/players?search=${encodeURIComponent(focused)}&season=2023`, 600)
        const choices = players.slice(0, 25).map((p: any) => ({
          name: `${p.player.name} - ${p.statistics[0].team.name}`,
          value: p.player.name
        }))
        return interaction.respond(choices)
      } catch { return interaction.respond([]) }
    }
    return
  }

  // COMMANDS
  if (!interaction.isChatInputCommand()) return

  // CRITICAL: Defer immediately to prevent timeout
  await interaction.deferReply()

  const reply = (e: EmbedBuilder) => interaction.editReply({ embeds: [e] })
  const error = (m: string) => interaction.editReply(`❌ ${m}`)

  try {
    const c = interaction.commandName

    if (c === 'help') return reply(new EmbedBuilder().setTitle('⚽ GoalWire - 25 Commands').setDescription('All options use dropdowns. Just start typing and select!').setColor(0x00AE86))

    if (c === 'live') {
      const m = await get('/fixtures?live=all', 60);
      if (!m?.length) return error('No live matches');
      const e = new EmbedBuilder().setTitle('🔴 Live').setColor(0xFF0000);
      m.slice(0,10).forEach(x=>e.addFields({name:`${x.teams.home.name} ${x.goals.home??0}-${x.goals.away??0} ${x.teams.away.name}`,value:`${x.league.name} • ${x.fixture.status.elapsed||0}'`}));
      return reply(e)
    }

    if (c === 'table') {
      const l = interaction.options.getString('league',true);
      const d = await get(`/standings?league=${LEAGUES[l]}&season=2023`,600);
      const t = d[0]?.league?.standings?.[0];
      if(!t) return error('Table unavailable');
      const e = new EmbedBuilder().setTitle(`📊 ${l}`).setColor(0x00AE86);
      t.slice(0,10).forEach(x=>e.addFields({name:`${x.rank}. ${x.team.name}`,value:`**${x.points}**pts • ${x.all.played}P`,inline:true}));
      return reply(e)
    }

    if (c === 'scorers') {
      const l = interaction.options.getString('league',true);
      const p = await get(`/players/topscorers?league=${LEAGUES[l]}&season=2023`,600);
      if(!p?.length) return error('No data');
      const e = new EmbedBuilder().setTitle(`🥇 ${l} Scorers`).setColor(0xFFD700);
      p.slice(0,10).forEach((s,j)=>e.addFields({name:`${j+1}. ${s.player.name}`,value:`${s.statistics[0].team.name} • **${s.statistics[0].goals.total||0}** goals`}));
      return reply(e)
    }

    if (c === 'assists') {
      const l = interaction.options.getString('league',true);
      const p = await get(`/players/topassists?league=${LEAGUES[l]}&season=2023`,600);
      if(!p?.length) return error('No data');
      const e = new EmbedBuilder().setTitle(`🎯 ${l} Assists`).setColor(0x57F287);
      p.slice(0,10).forEach((s,j)=>e.addFields({name:`${j+1}. ${s.player.name}`,value:`${s.statistics[0].team.name} • **${s.statistics[0].goals.assists||0}** assists`}));
      return reply(e)
    }

    if (c === 'injuries') {
      const n = interaction.options.getString('team',true);
      const id = await getTeamId(n);
      if(!id) return error(`Team "${n}" not found`);
      const d = await get(`/injuries?team=${id}&season=2023`,600);
      if(!d?.length) return reply(new EmbedBuilder().setTitle(`🤕 ${n} Injuries`).setDescription('No current injuries').setColor(0x57F287));
      const e = new EmbedBuilder().setTitle(`🤕 ${n} Injuries`).setColor(0xED4245);
      d.slice(0,10).forEach(x=>e.addFields({name:x.player.name,value:`${x.type} • ${x.reason||'Unknown'}`,inline:false}));
      return reply(e)
    }

    if (c === 'cards') {
      const n = interaction.options.getString('team',true);
      const id = await getTeamId(n);
      if(!id) return error(`Team "${n}" not found`);
      const d = await get(`/teams/statistics?team=${id}&league=39&season=2023`,3600);
      if(!d?.cards) return error('Card data unavailable');
      const e = new EmbedBuilder().setTitle(`🟨 ${n} Cards`).setColor(0xED4245).addFields(
        {name:'Yellow Cards',value:String(d.cards.yellow?.total||0),inline:true},
        {name:'Red Cards',value:String(d.cards.red?.total||0),inline:true}
      );
      return reply(e)
    }

    if (c === 'team') {
      const n = interaction.options.getString('name',true);
      const d = await get(`/teams?search=${encodeURIComponent(n)}`,3600);
      if(!d?.[0]) return error('Team not found');
      const t = d[0].team;
      const e = new EmbedBuilder().setTitle(t.name).setThumbnail(t.logo).setColor(0x0099FF).addFields(
        {name:'Country',value:t.country||'N/A',inline:true},
        {name:'Founded',value:String(t.founded||'N/A'),inline:true},
        {name:'Stadium',value:d[0].venue?.name||'N/A',inline:true}
      );
      return reply(e)
    }

    if (c === 'trophies') {
      const n = interaction.options.getString('team',true);
      const id = await getTeamId(n);
      if(!id) return error(`Team "${n}" not found`);
      const t = await get(`/trophies?team=${id}`,86400);
      if(!t?.length) return error(`${n} has no trophy data`);
      const td = await get(`/teams?search=${encodeURIComponent(n)}`,3600);
      const e = new EmbedBuilder().setTitle(`🏆 ${n} Trophies`).setThumbnail(td[0]?.team?.logo).setColor(0xFFD700);
      t.slice(0,15).forEach(x=>e.addFields({name:x.league,value:`${x.country} • **${x.count}×**`,inline:true}));
      return reply(e)
    }

    // Add other commands here using same pattern...

  } catch (err: any) {
    console.error(`[${interaction.commandName}] Error:`, err.message)
    const msg = err.message === 'RATE_LIMIT'? '⚠️ API rate limit (100/day). Wait 1 hour.'
      : err.message === 'INVALID_KEY'? '❌ Invalid API key. Check Railway variables.'
      : `Error: ${err.message}`
    await interaction.editReply(msg)
  }
})

client.login(process.env.DISCORD_TOKEN)
