import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { fetchSportsData, LEAGUES } from '../utils/api';

// Local helper to resolve team profiles easily within this master file
async function resolveTeam(name: string) {
  const data = await fetchSportsData(`/teams?search=${encodeURIComponent(name)}`);
  return data && data.length > 0 ? data[0] : null;
}

export const data = new SlashCommandBuilder()
  .setName('football')
  .setDescription('⚽ Ultimate Football Command Center')
  
  // 1-5: Live, Standings, Slates
  .addSubcommand(s => s.setName('live').setDescription('🔴 View real-time live matches'))
  .addSubcommand(s => s.setName('table').setDescription('📊 View league standings').addStringOption(o => o.setName('league').setDescription('Select league').setRequired(true).addChoices({ name: 'Premier League', value: 'Premier League' }, { name: 'La Liga', value: 'La Liga' }, { name: 'Serie A', value: 'Serie A' }, { name: 'Bundesliga', value: 'Bundesliga' }, { name: 'Ligue 1', value: 'Ligue 1' })))
  .addSubcommand(s => s.setName('scorers').setDescription('🏆 View top goal scorers').addStringOption(o => o.setName('league').setDescription('Select league').setRequired(true).addChoices({ name: 'Premier League', value: 'Premier League' }, { name: 'La Liga', value: 'La Liga' }, { name: 'Serie A', value: 'Serie A' }, { name: 'Bundesliga', value: 'Bundesliga' }, { name: 'Ligue 1', value: 'Ligue 1' })))
  .addSubcommand(s => s.setName('assists').setDescription('🎯 View top playmakers').addStringOption(o => o.setName('league').setDescription('Select league').setRequired(true).addChoices({ name: 'Premier League', value: 'Premier League' }, { name: 'La Liga', value: 'La Liga' }, { name: 'Serie A', value: 'Serie A' }, { name: 'Bundesliga', value: 'Bundesliga' }, { name: 'Ligue 1', value: 'Ligue 1' })))
  .addSubcommand(s => s.setName('fixtures').setDescription("📅 View today's scheduled match slates"))
  
  // 6-10: Timelines & Core Profiles
  .addSubcommand(s => s.setName('results').setDescription("⏮️ View yesterday's final match scores"))
  .addSubcommand(s => s.setName('team').setDescription('🛡️ View comprehensive team overview profiles').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('player').setDescription('👤 View structural player status stats').addStringOption(o => o.setName('name').setDescription('Player name').setRequired(true)))
  .addSubcommand(s => s.setName('injuries').setDescription('🏥 View current active team injury logs').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('next').setDescription('⏭️ View the next upcoming scheduled fixtures').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  
  // 11-15: Club Analytics & Management
  .addSubcommand(s => s.setName('last').setDescription('⏮️ View the last 5 match results and outcomes').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('trophies').setDescription('🏆 View total team trophy room collections').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('squad').setDescription('👥 View the complete official team squad roster').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('h2h').setDescription('⚔️ Compare structural historical profiles').addStringOption(o => o.setName('team1').setDescription('First team').setRequired(true).setAutocomplete(true).setAutocomplete(true)).addStringOption(o => o.setName('team2').setDescription('Second team').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('coach').setDescription('👨‍💼 View current coach profile metrics').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  
  // 16-20: Technical Strategies & Intelligence
  .addSubcommand(s => s.setName('venue').setDescription('🏟️ View detailed stadium venue configurations').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('transfers').setDescription('🔄 View recent transfer market log updates').addStringOption(o => o.setName('team').setDescription('Team name').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('predictions').setDescription('🔮 View advanced match prediction models').addStringOption(o => o.setName('home').setDescription('Home team').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('away').setDescription('Away team').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('stats').setDescription('📊 View real-time live match tactical stats').addStringOption(o => o.setName('team').setDescription('Team playing live').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s => s.setName('compare').setDescription('⚔️ Compare player statistics side-by-side').addStringOption(o => o.setName('player1').setDescription('First player').setRequired(true)).addStringOption(o => o.setName('player2').setDescription('Second player').setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const currentSeason = 2025;

  // 1. LIVE MATCH TRACKER (WITH FULL PAGINATION BUTTON INTERFACE)
  if (subcommand === 'live') {
    await interaction.deferReply();
    let matches = await fetchSportsData('/fixtures?live=all');
    if (!matches || !matches.length) return interaction.editReply('ℹ️ No live matches are active right now.');

    let page = 0; const itemsPerPage = 5;
    const getEmbed = (p: number, data: any[]) => {
      const embed = new EmbedBuilder().setTitle('🔴 LIVE FOOTBALL TRACKER').setColor(0xFF0000).setTimestamp();
      data.slice(p * itemsPerPage, (p * itemsPerPage) + itemsPerPage).forEach((m: any) => {
        embed.addFields({ name: `🏆 ${m.league?.name || 'League'}`, value: `**${m.teams.home.name}** ${m.goals.home} - ${m.goals.away} **${m.teams.away.name}**\n⏱️ Time: \`${m.fixture.status.elapsed}'\`` });
      });
      return embed.setFooter({ text: `Page ${p + 1} of ${Math.ceil(data.length / itemsPerPage)}` });
    };

    const getButtons = (p: number, data: any[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('p').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
      new ButtonBuilder().setCustomId('r').setLabel('🔄').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('n').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p >= Math.ceil(data.length / itemsPerPage) - 1)
    );

    const resp = await interaction.editReply({ embeds: [getEmbed(page, matches)], components: [getButtons(page, matches)] });
    const col = resp.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    col.on('collect', async (b) => {
      if (b.user.id !== interaction.user.id) return b.reply({ content: 'Unauthorized usage.', ephemeral: true });
      await b.deferUpdate();
      if (b.customId === 'p' && page > 0) page--;
      else if (b.customId === 'n') page++;
      else if (b.customId === 'r') matches = (await fetchSportsData('/fixtures?live=all')) || matches;
      await interaction.editReply({ embeds: [getEmbed(page, matches)], components: [getButtons(page, matches)] });
    });
  }

  // 2. LEAGUE TABLE STANDINGS
  else if (subcommand === 'table') {
    await interaction.deferReply();
    const lName = interaction.options.getString('league', true);
    const standings = (await fetchSportsData(`/standings?league=${LEAGUES[lName]}&season=${currentSeason}`))?.[0]?.league?.standings?.[0];
    if (!standings) return interaction.editReply('❌ League data unavailable.');
    
    let text = '`Pos Team            P   GD  PTS`\n';
    standings.slice(0, 15).forEach((item: any) => {
      text += `\`${String(item.rank).padEnd(3, ' ')}${(item.team.name).substring(0, 14).padEnd(15, ' ')}${String(item.all.played).padEnd(3, ' ')}${String(item.goalsDiff).padEnd(4, ' ')}${item.points}\`\n`;
    });
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`📊 ${lName} Standings`).setDescription(text).setColor(0x00FF00)] });
  }

  // 3. TOP SCORERS
  else if (subcommand === 'scorers') {
    await interaction.deferReply();
    const name = interaction.options.getString('league', true);
    const data = await fetchSportsData(`/players/topscorers?league=${LEAGUES[name]}&season=${currentSeason}`);
    if (!data) return interaction.editReply('❌ No scorer data found.');
    let list = '';
    data.slice(0, 10).forEach((i: any, idx: number) => { list += `**${idx + 1}.** ${i.player.name} (${i.statistics[0].team.name}) — **${i.statistics[0].goals.total}** ⚽\n`; });
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🏆 Top Scorers: ${name}`).setDescription(list).setColor(0xF39C12)] });
  }

  // 4. TOP ASSISTS
  else if (subcommand === 'assists') {
    await interaction.deferReply();
    const name = interaction.options.getString('league', true);
    const data = await fetchSportsData(`/players/topassists?league=${LEAGUES[name]}&season=${currentSeason}`);
    if (!data) return interaction.editReply('❌ No playmaking records found.');
    let list = '';
    data.slice(0, 10).forEach((i: any, idx: number) => { list += `**${idx + 1}.** ${i.player.name} (${i.statistics[0].team.name}) — **${i.statistics[0].goals.assists}** 🎯\n`; });
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🎯 Playmakers: ${name}`).setDescription(list).setColor(0x3498DB)] });
  }

  // 5. TODAY'S FIXTURES
  else if (subcommand === 'fixtures') {
    await interaction.deferReply();
    const today = new Date().toISOString().split('T')[0];
    const data = await fetchSportsData(`/fixtures?date=${today}`);
    if (!data || !data.length) return interaction.editReply('ℹ️ No matches scheduled for today.');
    const embed = new EmbedBuilder().setTitle(`📅 Today's Fixtures (${today})`).setColor(0x2ECC71);
    data.slice(0, 15).forEach((m: any) => embed.addFields({ name: `🏆 ${m.league.name}`, value: `\`${m.fixture.status.short}\` ${m.teams.home.name} vs ${m.teams.away.name}` }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 6. YESTERDAY'S RESULTS
  else if (subcommand === 'results') {
    await interaction.deferReply();
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const data = await fetchSportsData(`/fixtures?date=${yest}`);
    if (!data || !data.length) return interaction.editReply('ℹ️ No match data found for yesterday.');
    const embed = new EmbedBuilder().setTitle(`⏮️ Yesterday's Final Scores (${yest})`).setColor(0xE74C3C);
    data.slice(0, 15).forEach((m: any) => embed.addFields({ name: `🏆 ${m.league.name}`, value: `${m.teams.home.name} **${m.goals.home} - ${m.goals.away}** ${m.teams.away.name}` }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 7. TEAM DASHBOARD PROFILE
  else if (subcommand === 'team') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team dashboard not found.');
    const embed = new EmbedBuilder().setTitle(`🛡️ ${t.team.name}`).setThumbnail(t.team.logo).setColor(0x34495E)
      .addFields({ name: 'Country', value: t.team.country || 'N/A', inline: true }, { name: 'Founded', value: `${t.team.founded || 'N/A'}`, inline: true }, { name: 'Stadium', value: t.venue.name || 'N/A' });
    return interaction.editReply({ embeds: [embed] });
  }

  // 8. PLAYER DETAILS CARD
  else if (subcommand === 'player') {
    await interaction.deferReply();
    const data = await fetchSportsData(`/players?search=${encodeURIComponent(interaction.options.getString('name', true))}&season=${currentSeason}`);
    if (!data || !data.length) return interaction.editReply('❌ Player profile data sheet missing.');
    const p = data[0].player, s = data[0].statistics[0];
    const embed = new EmbedBuilder().setTitle(`👤 ${p.name}`).setThumbnail(p.photo).setColor(0x9B59B6)
      .addFields({ name: 'Club', value: s.team.name, inline: true }, { name: 'Apps', value: `${s.games.appearences || 0}`, inline: true }, { name: 'Goals', value: `${s.goals.total || 0}`, inline: true });
    return interaction.editReply({ embeds: [embed] });
  }

  // 9. ACTIVE MEDICAL INJURY LOGS
  else if (subcommand === 'injuries') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team validation failed.');
    const logs = await fetchSportsData(`/injuries?team=${t.team.id}&season=${currentSeason}`);
    if (!logs || !logs.length) return interaction.editReply(`✅ No active injury logs reported for **${t.team.name}**.`);
    const embed = new EmbedBuilder().setTitle(`🏥 Injury Room: ${t.team.name}`).setColor(0xE67E22);
    logs.slice(0, 10).forEach((inj: any) => embed.addFields({ name: inj.player.name, value: `Reason: \`${inj.player.reason}\`` }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 10. UPCOMING FIXTURES TIMELINE
  else if (subcommand === 'next') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team validation failed.');
    const next = await fetchSportsData(`/fixtures?team=${t.team.id}&next=5`);
    if (!next || !next.length) return interaction.editReply('ℹ️ No upcoming matches scheduled.');
    const embed = new EmbedBuilder().setTitle(`⏭️ Upcoming Slate: ${t.team.name}`).setColor(0x3498DB);
    next.forEach((m: any) => embed.addFields({ name: `🏆 ${m.league.name}`, value: `🏠 ${m.teams.home.name} vs ✈️ ${m.teams.away.name}` }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 11. RECENT OUTCOME HISTORY
  else if (subcommand === 'last') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team validation failed.');
    const last = await fetchSportsData(`/fixtures?team=${t.team.id}&last=5`);
    if (!last || !last.length) return interaction.editReply('ℹ️ Historical timeline diagnostics empty.');
    const embed = new EmbedBuilder().setTitle(`⏮️ Recent Results: ${t.team.name}`).setColor(0x95A5A6);
    last.forEach((m: any) => embed.addFields({ name: `🏆 ${m.league.name}`, value: `${m.teams.home.name} **${m.goals.home}-${m.goals.away}** ${m.teams.away.name}` }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 12. TROPHY ROOM CABINET HONORS
  else if (subcommand === 'trophies') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team validation failed.');
    const trophies = await fetchSportsData(`/trophies?team=${t.team.id}`);
    if (!trophies || !trophies.length) return interaction.editReply('ℹ️ No trophy room parameters found.');
    let desc = ''; trophies.slice(0, 12).forEach((tr: any) => desc += `• **${tr.league}** (${tr.country}) — x${tr.count || 1}\n`);
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🏆 Honors: ${t.team.name}`).setDescription(desc).setColor(0xF1C40F)] });
  }

  // 13. OFFICIAL SQUAD ROSTER REGISTRY
  else if (subcommand === 'squad') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team validation failed.');
    const squad = await fetchSportsData(`/players/squads?team=${t.team.id}`);
    if (!squad || !squad.length) return interaction.editReply('ℹ️ Active team registry sheets not compiled.');
    const embed = new EmbedBuilder().setTitle(`👥 Club Roster: ${t.team.name}`).setColor(0x16A085);
    const posMap: Record<string, string[]> = { Goalkeeper: [], Defender: [], Midfielder: [], Attacker: [] };
    squad[0].players?.forEach((p: any) => posMap[p.position]?.push(p.name));
    Object.entries(posMap).forEach(([pos, list]) => embed.addFields({ name: pos, value: list.slice(0, 6).join(', ') + '...' }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 14. HEAD-TO-HEAD HISTORY MATRIX
  else if (subcommand === 'h2h') {
    await interaction.deferReply();
    const p1 = await resolveTeam(interaction.options.getString('team1', true));
    const p2 = await resolveTeam(interaction.options.getString('team2', true));
    if (!p1 || !p2) return interaction.editReply('❌ Validation failure.');
    const logs = await fetchSportsData(`/fixtures/headtohead?h2h=${p1.team.id}-${p2.team.id}&last=5`);
    if (!logs || !logs.length) return interaction.editReply('ℹ️ No historical logs exist between these configurations.');
    const embed = new EmbedBuilder().setTitle('⚔️ Head-to-Head History Matrix').setColor(0xC0392B);
    logs.forEach((m: any) => embed.addFields({ name: `🏆 ${m.league.name}`, value: `${m.teams.home.name} **${m.goals.home}-${m.goals.away}** ${m.teams.away.name}` }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 15. COACH TRACKING DATA
  else if (subcommand === 'coach') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team profile invalid.');
    const data = await fetchSportsData(`/coaches?team=${t.team.id}`);
    if (!data || !data.length) return interaction.editReply('ℹ️ No coach details on file.');
    const c = data[0];
    const embed = new EmbedBuilder().setTitle(`👨‍💼 Profile: ${c.name}`).setThumbnail(c.photo).setColor(0x3498DB)
      .addFields({ name: 'Age', value: `${c.age || 'N/A'}`, inline: true }, { name: 'Nationality', value: c.nationality || 'N/A', inline: true });
    return interaction.editReply({ embeds: [embed] });
  }

  // 16. STADIUM VENUE CONFIGURATIONS
  else if (subcommand === 'venue') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t || !t.venue) return interaction.editReply('❌ Stadium data sheet missing.');
    const embed = new EmbedBuilder().setTitle(`🏟️ ${t.venue.name}`).setImage(t.venue.image).setColor(0x2ECC71)
      .addFields({ name: 'City', value: t.venue.city || 'N/A', inline: true }, { name: 'Capacity', value: t.venue.capacity?.toLocaleString() || 'N/A', inline: true });
    return interaction.editReply({ embeds: [embed] });
  }

  // 17. TRANSFER MARKET INTELLIGENCE LOGS
  else if (subcommand === 'transfers') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team identifier not resolved.');
    const data = await fetchSportsData(`/transfers?team=${t.team.id}`);
    if (!data || !data.length) return interaction.editReply('ℹ️ No recent structural logs recorded.');
    const embed = new EmbedBuilder().setTitle(`🔄 Recent Transfers: ${t.team.name}`).setColor(0xE67E22);
    data.slice(0, 5).forEach((tr: any) => {
      const lat = tr.transfers?.[0];
      if (lat) embed.addFields({ name: tr.player.name, value: `From: *${lat.teams.out.name}* ➡️ To: *${lat.teams.in.name}*\nType: \`${lat.type}\`` });
    });
    return interaction.editReply({ embeds: [embed] });
  }

  // 18. MATCH PREDICTIVE ANALYTICS MODELS
  else if (subcommand === 'predictions') {
    await interaction.deferReply();
    const h = await resolveTeam(interaction.options.getString('home', true));
    const a = await resolveTeam(interaction.options.getString('away', true));
    if (!h || !a) return interaction.editReply('❌ Match configurations invalid.');
    const h2h = await fetchSportsData(`/fixtures/headtohead?h2h=${h.team.id}-${a.team.id}&next=1`);
    if (!h2h || !h2h.length) return interaction.editReply('ℹ️ No matching upcoming slate found to calculate analytics for.');
    const pred = await fetchSportsData(`/predictions?fixture=${h2h[0].fixture.id}`);
    if (!pred || !pred.length) return interaction.editReply('ℹ️ Analytical model projections offline for this game.');
    const p = pred[0];
    const embed = new EmbedBuilder().setTitle('🔮 Match Predictive Insight').setColor(0x9B59B6)
      .addFields({ name: 'Advice Metric', value: p.predictions.advice || 'N/A' }, { name: 'Probability Line', value: `🏠 Home: ${p.predictions.percent.home} | 🤝 Draw: ${p.predictions.percent.draw} | ✈️ Away: ${p.predictions.percent.away}` });
    return interaction.editReply({ embeds: [embed] });
  }

  // 19. LIVE MATCH TACTICAL STATS
  else if (subcommand === 'stats') {
    await interaction.deferReply();
    const t = await resolveTeam(interaction.options.getString('team', true));
    if (!t) return interaction.editReply('❌ Team parsing target failed.');
    const live = await fetchSportsData(`/fixtures?team=${t.team.id}&live=all`);
    if (!live || !live.length) return interaction.editReply('ℹ️ This team has no matches live right now.');
    const stats = await fetchSportsData(`/fixtures/statistics?fixture=${live[0].fixture.id}&team=${t.team.id}`);
    if (!stats || !stats.length) return interaction.editReply('ℹ️ Tactical metrics generation has not started yet.');
    const embed = new EmbedBuilder().setTitle(`📊 Live Match Stats: ${t.team.name}`).setColor(0x34495E);
    stats[0].statistics.slice(0, 9).forEach((s: any) => embed.addFields({ name: s.type, value: `${s.value ?? 0}`, inline: true }));
    return interaction.editReply({ embeds: [embed] });
  }

  // 20. SIDE-BY-SIDE PLAYER COMPARISON
  else if (subcommand === 'compare') {
    await interaction.deferReply();
    const r1 = await fetchSportsData(`/players?search=${encodeURIComponent(interaction.options.getString('player1', true))}&season=${currentSeason}`);
    const r2 = await fetchSportsData(`/players?search=${encodeURIComponent(interaction.options.getString('player2', true))}&season=${currentSeason}`);
    if (!r1?.length || !r2?.length) return interaction.editReply('❌ Could not map calculations. Verify player spellings.');
    const p1 = r1[0].player, s1 = r1[0].statistics[0], p2 = r2[0].player, s2 = r2[0].statistics[0];
    const embed = new EmbedBuilder().setTitle('⚔️ Performance Comparison Battle').setColor(0x2C3E50)
      .addFields(
        { name: 'Metrics Grid', value: '👕 **Club**\n🏟️ **Apps**\n⚽ **Goals**\n🎯 **Assists**', inline: true },
        { name: p1.name, value: `${s1.team.name}\n${s1.games.appearences || 0}\n${s1.goals.total || 0}\n${s1.goals.assists || 0}`, inline: true },
        { name: p2.name, value: `${s2.team.name}\n${s2.games.appearences || 0}\n${s2.goals.total || 0}\n${s2.goals.assists || 0}`, inline: true }
      );
    return interaction.editReply({ embeds: [embed] });
  }
}