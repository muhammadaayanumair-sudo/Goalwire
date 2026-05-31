 import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchSportsData, LEAGUES } from '../utils/api';

export const data = new SlashCommandBuilder()
  .setName('football')
  .setDescription('⚽ Complete live football stats tracking dashboard')
  // 1. SCORERS SUBCOMMAND
  .addSubcommand(sub =>
    sub.setName('scorers')
       .setDescription('Top scorers leaderboard')
       .addStringOption(opt =>
          opt.setName('league')
             .setDescription('Select the football league')
             .setRequired(true)
             .addChoices(
               { name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', value: 'Premier League' },
               { name: '🇪🇸 La Liga', value: 'La Liga' },
               { name: '🇮🇹 Serie A', value: 'Serie A' },
               { name: '🇩🇪 Bundesliga', value: 'Bundesliga' },
               { name: '🇫🇷 Ligue 1', value: 'Ligue 1' }
             )
       )
  )
  // 2. ASSISTS SUBCOMMAND
  .addSubcommand(sub =>
    sub.setName('assists')
       .setDescription('Top playmaking assists leaderboard')
       .addStringOption(opt =>
          opt.setName('league')
             .setDescription('Select the football league')
             .setRequired(true)
             .addChoices(
               { name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', value: 'Premier League' },
               { name: '🇪🇸 La Liga', value: 'La Liga' },
               { name: '🇮🇹 Serie A', value: 'Serie A' },
               { name: '🇩🇪 Bundesliga', value: 'Bundesliga' },
               { name: '🇫🇷 Ligue 1', value: 'Ligue 1' }
             )
       )
  )
  // PLACEHOLDERS FOR INFRASTRUCTURE STRUCTURES
  .addSubcommand(sub => sub.setName('formation').setDescription('View team line-ups'))
  .addSubcommand(sub => sub.setName('cards').setDescription('View disciplinary stats'))
  .addSubcommand(sub => sub.setName('h2h').setDescription('Compare team head-to-head records'));

export async function execute(interaction: any) {
  // Defer the reply immediately to stop Discord's strict 3-second timeout rule
  await interaction.deferReply();
  
  const subcommand = interaction.options.getSubcommand();
  
  // Handle infrastructure placeholders safely without throwing code crashes
  if (['formation', 'cards', 'h2h'].includes(subcommand)) {
    return interaction.editReply(`🚧 The \`/${subcommand}\` command infrastructure is valid, but full data rendering logic is not written yet!`);
  }

  const leagueName = interaction.options.getString('league');
  const leagueId = LEAGUES[leagueName || ''];
  
  // 2025 matches the active 2025/2026 global season schedules
  const currentSeason = 2025; 

  if (!leagueId) {
    return interaction.editReply('❌ Invalid league selection detected.');
  }

  try {
    // === HANDLE TOP SCORERS ===
    if (subcommand === 'scorers') {
      const apiResponse = await fetchSportsData(`/players/topscorers?league=${leagueId}&season=${currentSeason}`);
      
      if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length === 0) {
        return interaction.editReply('❌ No scorer data found for this league setup right now.');
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚽ Top Scorers — ${leagueName}`)
        .setColor(0x0099FF)
        .setTimestamp();

      let leaderboardText = '';
      apiResponse.slice(0, 10).forEach((item: any, index: number) => {
        const name = item.player?.name || 'Unknown Player';
        const goals = item.statistics?.[0]?.goals?.total ?? 0;
        const team = item.statistics?.[0]?.team?.name || 'Unknown Team';
        leaderboardText += `**${index + 1}. ${name}** (${team}) — **${goals}** goals\n`;
      });

      embed.setDescription(leaderboardText || 'No entry details available.');

      // Shield validation: safe-guards against empty string values or api image drops
      const teamLogo = apiResponse[0]?.statistics?.[0]?.team?.logo;
      if (typeof teamLogo === 'string' && teamLogo.startsWith('http')) {
        embed.setThumbnail(teamLogo);
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // === HANDLE TOP ASSISTS ===
    if (subcommand === 'assists') {
      const apiResponse = await fetchSportsData(`/players/topassists?league=${leagueId}&season=${currentSeason}`);
      
      if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length === 0) {
        return interaction.editReply('❌ No playmaking records found for this league setup right now.');
      }

      const embed = new EmbedBuilder()
        .setTitle(`🅰️ Top Assists — ${leagueName}`)
        .setColor(0x2ECC71)
        .setTimestamp();

      let leaderboardText = '';
      apiResponse.slice(0, 10).forEach((item: any, index: number) => {
        const name = item.player?.name || 'Unknown Player';
        const assists = item.statistics?.[0]?.goals?.assists ?? 0;
        const team = item.statistics?.[0]?.team?.name || 'Unknown Team';
        leaderboardText += `**${index + 1}. ${name}** (${team}) — **${assists}** assists\n`;
      });

      embed.setDescription(leaderboardText || 'No entry details available.');

      const teamLogo = apiResponse[0]?.statistics?.[0]?.team?.logo;
      if (typeof teamLogo === 'string' && teamLogo.startsWith('http')) {
        embed.setThumbnail(teamLogo);
      }

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('[Execution Error Block]', error);
    return interaction.editReply('❌ An unexpected processing error occurred within the dashboard loop.');
  }
}