import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('football')
  .setDescription('GoalWire Master Dashboard')
  // 1-5: Matches & Stats
  .addSubcommand(sub => sub.setName('scorers').setDescription('Top goal scorers').addStringOption(o => o.setName('league').setRequired(true)))
  .addSubcommand(sub => sub.setName('assists').setDescription('Top assists').addStringOption(o => o.setName('league').setRequired(true)))
  .addSubcommand(sub => sub.setName('fixtures').setDescription('Upcoming matches').addStringOption(o => o.setName('league').setRequired(true)))
  .addSubcommand(sub => sub.setName('results').setDescription('Recent results').addStringOption(o => o.setName('league').setRequired(true)))
  .addSubcommand(sub => sub.setName('table').setDescription('League table').addStringOption(o => o.setName('league').setRequired(true)))
  // 6-10: Player/Team
  .addSubcommand(sub => sub.setName('team').setDescription('Team profile').addStringOption(o => o.setName('name').setRequired(true)))
  .addSubcommand(sub => sub.setName('player').setDescription('Player profile').addStringOption(o => o.setName('name').setRequired(true)))
  .addSubcommand(sub => sub.setName('lineups').setDescription('Match lineups').addStringOption(o => o.setName('fixture_id').setRequired(true)))
  .addSubcommand(sub => sub.setName('injuries').setDescription('Injury report').addStringOption(o => o.setName('league').setRequired(true)))
  .addSubcommand(sub => sub.setName('transfers').setDescription('Team transfers').addStringOption(o => o.setName('team').setRequired(true)))
  // 11-15: Live/Tactics
  .addSubcommand(sub => sub.setName('live').setDescription('Live matches'))
  .addSubcommand(sub => sub.setName('cards').setDescription('Discipline leaderboard').addStringOption(o => o.setName('league').setRequired(true)))
  .addSubcommand(sub => sub.setName('cleansheets').setDescription('Clean sheets').addStringOption(o => o.setName('league').setRequired(true)))
  .addSubcommand(sub => sub.setName('predictions').setDescription('Match predictions').addStringOption(o => o.setName('fixture_id').setRequired(true)))
  .addSubcommand(sub => sub.setName('head2head').setDescription('Compare teams').addStringOption(o => o.setName('team1').setRequired(true)).addStringOption(o => o.setName('team2').setRequired(true)))
  // 16-20: Advanced/Management
  .addSubcommand(sub => sub.setName('coach').setDescription('Manager profile').addStringOption(o => o.setName('name').setRequired(true)))
  .addSubcommand(sub => sub.setName('venue').setDescription('Stadium info').addStringOption(o => o.setName('name').setRequired(true)))
  .addSubcommand(sub => sub.setName('form').setDescription('Recent form').addStringOption(o => o.setName('team').setRequired(true)))
  .addSubcommand(sub => sub.setName('trophies').setDescription('Trophy room').addStringOption(o => o.setName('name').setRequired(true)))
  .addSubcommand(sub => sub.setName('status').setDescription('API Health Check'))
  // Automation Admin Command
  .addSubcommand(sub => sub.setName('set-channel').setDescription('Set channel for live updates').addChannelOption(o => o.setName('channel').setRequired(true)));