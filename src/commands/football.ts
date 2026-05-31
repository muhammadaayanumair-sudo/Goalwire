import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

// 1. Defining the Big Five leagues
const leagueChoices = [
  { name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League', value: 'Premier League' },
  { name: '🇪🇸 La Liga', value: 'La Liga' },
  { name: '🇮🇹 Serie A', value: 'Serie A' },
  { name: '🇩🇪 Bundesliga', value: 'Bundesliga' },
  { name: '🇫🇷 Ligue 1', value: 'Ligue 1' }
];

export const data = new SlashCommandBuilder()
  .setName('football')
  .setDescription('GoalWire Football Dashboard')
  // Example of applying choices to a command
  .addSubcommand(sub => 
    sub.setName('scorers')
       .setDescription('View top goal scorers')
       .addStringOption(o => 
         o.setName('league')
          .setDescription('Select a league')
          .setRequired(true)
          .addChoices(...leagueChoices) // Using the Big Five choices
       )
  )
  .addSubcommand(sub => 
    sub.setName('fixtures')
       .setDescription('View upcoming matches')
       .addStringOption(o => 
         o.setName('league')
          .setDescription('Select a league')
          .setRequired(true)
          .addChoices(...leagueChoices)
       )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const league = interaction.options.getString('league');

  if (subcommand === 'scorers') {
    await interaction.reply(`Fetching top scorers for ${league}...`);
    // Add your API logic here
  } else if (subcommand === 'fixtures') {
    await interaction.reply(`Fetching fixtures for ${league}...`);
    // Add your API logic here
  }
}