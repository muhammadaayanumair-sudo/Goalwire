import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { fetchSportsData, LEAGUES } from '../utils/api';

export const data = new SlashCommandBuilder()
  .setName('football')
  .setDescription('⚽ Football tracking utility dashboard')
  .addSubcommand(sub =>
    sub.setName('scorers')
       .setDescription('Top scorers leaderboard')
       .addStringOption(opt =>
          opt.setName('league')
             .setDescription('Select the league')
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
    sub.setName('results')
       .setDescription('View recently finished matches')
       .addStringOption(opt =>
          opt.setName('league')
             .setDescription('Select the league')
             .setRequired(true)
             .addChoices(
               { name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', value: 'Premier League' },
               { name: '🇪🇸 La Liga', value: 'La Liga' },
               { name: '🇮🇹 Serie A', value: 'Serie A' },
               { name: '🇩🇪 Bundesliga', value: 'Bundesliga' },
               { name: '🇫🇷 Ligue 1', value: 'Ligue 1' }
             )
       )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Acknowledge the command immediately to stop the 3-second timeout rule
  await interaction.deferReply();
  
  const subcommand = interaction.options.getSubcommand(true);
  const leagueName = interaction.options.getString('league', true);
  const leagueId = LEAGUES[leagueName];
  
  // Using 2025 as it represents the completed/active season tracking block for global lookups
  const currentSeason = 2025; 

  try {
    if (subcommand === 'scorers') {
      const data = await fetchSportsData(`/players/topscorers?league=${leagueId}&season=${currentSeason}`);
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return interaction.editReply(`ℹ️ No stats records fetched for **${leagueName}** (${currentSeason}). The API endpoint might be updating data keys.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚽ Top Scorers — ${leagueName}`)
        .setColor(0x0099FF);

      let textContent = '';
      data.slice(0, 10).forEach((item: any, i: number) => {
        const name = item.player?.name || 'Unknown Player';
        const team = item.statistics?.[0]?.team?.name || 'Team';
        const goals = item.statistics?.[0]?.goals?.total ?? 0;
        textContent += `**${i + 1}. ${name}** (${team}) — **${goals}** goals\n`;
      });

      embed.setDescription(textContent);
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'results') {
      const data = await fetchSportsData(`/fixtures?league=${leagueId}&season=${currentSeason}&last=10`);
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return interaction.editReply(`🏁 No recent match fixtures data verified for **${leagueName}** yet.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏁 Match Results — ${leagueName}`)
        .setColor(0xE74C3C);

      let textContent = '';
      data.forEach((item: any) => {
        const home = item.teams?.home?.name || 'Home';
        const away = item.teams?.away?.name || 'Away';
        const homeGoals = item.goals?.home ?? 0;
        const awayGoals = item.goals?.away ?? 0;
        textContent += `• **${home}** ${homeGoals} - ${awayGoals}  **${away}**\n`;
      });

      embed.setDescription(textContent);
      return interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    return interaction.editReply(`❌ System Engine Error: \`${error?.message || 'Data alignment issue'}\``);
  }
}