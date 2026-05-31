import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

// Initialize the Discord Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Create a collection to hold our slash commands
const commands = new Collection<string, any>();

// Path to the commands directory
const commandsPath = path.join(__dirname, 'commands');

// Read your football.ts file dynamically
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      commands.set(command.data.name, command);
      console.log(`[Commands] Successfully loaded command: /${command.data.name}`);
    }
  }
}

// 1. When the bot client is ready, register the slash commands globally
client.once('ready', async () => {
  console.log(`[Bot Ready] Logged in as ${client.user?.tag}`);

  const token = process.env.DISCORD_TOKEN;
  const clientId = client.user?.id;

  if (!token || !clientId) {
    console.error('[Deploy Error] Missing DISCORD_TOKEN or client ID. Slash commands cannot be registered.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  
  try {
    console.log('[Deploy] Starting global application (/) commands refresh...');
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
    
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData }
    );
    
    console.log('[Deploy] Successfully reloaded all application (/) commands globally!');
  } catch (error) {
    console.error('[Deploy Error] Failed to deploy slash commands:', error);
  }
});

// 2. Listen for interactions (when users run commands in chat)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Execution Error] Error running /${interaction.commandName}:`, error);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: '❌ There was an internal error executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ There was an internal error executing this command!', ephemeral: true });
    }
  }
});

// Log your bot into Discord using your secure environment token
client.login(process.env.DISCORD_TOKEN);