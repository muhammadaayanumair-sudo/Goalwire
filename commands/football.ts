import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { fetchSportsData, LEAGUES } from '../utils/api';

export const data = new SlashCommandBuilder()
  .setName('football')
  .setDescription('⚽ Complete live football stats tracking dashboard')
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
  .addSubcommand(sub => sub.setName('formation').setDescription('View team line-ups'))
  .addSubcommand(sub => sub.setName('cards').setDescription('View disciplinary stats'))
  .addSubcommand(sub => sub.setName('h2h').setDescription('Compare team head-to-head records'));

export async function execute(interaction: ChatInputCommandInteraction) {
  // 1. Prevent early timeout immediately
  await interaction.deferReply();
  
  const subcommand = interaction.options.getSubcommand(true);
  
  // Handle layout infrastructure placeholders safely
  if (['formation', 'cards', 'h2h'].includes(subcommand)) {
    return interaction.editReply(`🚧 The \`/${subcommand}\` command infrastructure is valid, but full data rendering logic is not written yet!`);
  }

  const leagueName = interaction.options.getString('league', true);
  const leagueId = LEAGUES[leagueName];
  const currentSeason = 2025; // 2025/2026 active season timeline

  if (!leagueId) {
    return interaction.editReply('❌ Invalid league selection detected.');
  }

  try {
    // === SCORERS MAIN ENGINE ===
    if (subcommand === 'scorers') {
      const apiResponse = await fetchSportsData(`/players/topscorers?league=${leagueId}&season=${currentSeason}`);
      
      if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length === 0) {
        return interaction.editReply(`❌ No scorer data returned from the sports network for ${leagueName} (${currentSeason} season). Your API plan might not have access to this league.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚽ Top Scorers — ${leagueName}`)
        .setColor(0x0099FF)
        .setTimestamp();

      let leaderboardText = '';
      apiResponse.slice(0, 10).forEach((item: any, index: number) => {
        const name = item.player?.name || 'Unknown';
        const goals = item.statistics?.[0]?.goals?.total ?? 0;
        const team = item.statistics?.[0]?.team?.name || 'Unknown';
        leaderboardText += `**${index + 1}. ${name}** (${team}) — **${goals}** goals\n`;
      });

      embed.setDescription(leaderboardText || 'No leaderboard data.');

      const teamLogo = apiResponse[0]?.statistics?.[0]?.team?.logo;
      if (typeof teamLogo === 'string' && teamLogo.startsWith('http')) {
        embed.setThumbnail(teamLogo);
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // === ASSISTS MAIN ENGINE ===
    if (subcommand === 'assists') {
      const apiResponse = await fetchSportsData(`/players/topassists?league=${leagueId}&season=${currentSeason}`);
      
      if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length === 0) {
        return interaction.editReply(`❌ No assist data returned from the sports network for ${leagueName} (${currentSeason} season). Your API plan might not have access to this league.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`🅰️ Top Assists — ${leagueName}`)
        .setColor(0x2ECC71)
        .setTimestamp();

      let leaderboardText = '';
      apiResponse.slice(0, 10).forEach((item: any, index: number) => {
        const name = item.player?.name || 'Unknown';
        const assists = item.statistics?.[0]?.goals?.assists ?? 0;
        const team = item.statistics?.[0]?.team?.name || 'Unknown';
        leaderboardText += `**${index + 1}. ${name}** (${team}) — **${assists}** assists\n`;
      });

      embed.setDescription(leaderboardText || 'No leaderboard data.');

      const teamLogo = apiResponse[0]?.statistics?.[0]?.team?.logo;
      if (typeof teamLogo === 'string' && teamLogo.startsWith('http')) {
        embed.setThumbnail(teamLogo);
      }

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (error: any) {
    console.error('[Execution Engine Crash Location]', error);
    return interaction.editReply(`❌ Processing error inside the command code: ${error?.message || 'Unknown issue'}`);
  }
}