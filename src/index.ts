import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fetchSportsData } from './utils/api';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('❌ CRITICAL ERROR: DISCORD_TOKEN is missing!');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
(client as any).commands = new Collection();

const POPULAR_TEAMS = [
  'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Manchester City', 'Manchester United',
  'Liverpool', 'Chelsea', 'Arsenal', 'Tottenham', 'Bayern Munich', 'Borussia Dortmund',
  'PSG', 'Juventus', 'AC Milan', 'Inter', 'Napoli', 'Roma', 'Ajax', 'Benfica', 'Porto'
];

// Load commands dynamically from the commands folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
const slashCommandsJSON: any[] = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    (client as any).commands.set(command.data.name, command);
    slashCommandsJSON.push(command.data.toJSON());
  }
}

client.once('ready', async () => {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    console.log('🔄 Registering global slash commands...');
    await rest.put(Routes.applicationCommands(client.user!.id), { body: slashCommandsJSON });
    console.log(`✅ GoalWire is fully live! Loaded ${slashCommandsJSON.length} files into the command center.`);
  } catch (error) {
    console.error('❌ Failed to deploy slash commands:', error);
  }
});

// Centralized interaction routing engine
client.on('interactionCreate', async (interaction) => {
  // 1. Handle Autocomplete Request Logic
  if (interaction.isAutocomplete()) {
    try {
      const focused = interaction.options.getFocused(true);
      const value = focused.value.trim().toLowerCase();

      if (['team', 'name', 'team1', 'team2', 'home', 'away'].includes(focused.name)) {
        let choices = POPULAR_TEAMS.filter(t => t.toLowerCase().includes(value));
        
        if (value.length >= 2 && choices.length < 15) {
          const apiData = await fetchSportsData(`/teams?search=${encodeURIComponent(value)}`);
          if (apiData) {
            const extra = apiData.map((t: any) => t.team?.name).filter((n: string) => n && !choices.includes(n));
            choices = [...choices, ...extra];
          }
        }
        return interaction.respond(choices.slice(0, 25).map(c => ({ name: c, value: c })));
      }
    } catch (err) {
      console.error('[Autocomplete Error]', err);
    }
    return;
  }

  // 2. Handle Standard Chat Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = (client as any).commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'An internal execution error has occurred.' });
      } else {
        await interaction.reply({ content: 'An internal execution error has occurred.', ephemeral: true });
      }
    }
  }
});

client.login(DISCORD_TOKEN);