import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
export const commands = new Collection<string, any>();

// 1. LOAD COMMANDS CLEANLY
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.set(command.data.name, command);
      console.log(`[Loaded Command]: /${command.data.name}`);
    }
  }
}

// 2. EMBEDDED EVENTS FOR ABSOLUTE STABILITY
client.once('ready', async () => {
  console.log(`[Bot Online] Logged in as ${client.user?.tag}`);
  const token = process.env.DISCORD_TOKEN;
  const clientId = client.user?.id;
  if (!token || !clientId) return;

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log('[Deploy] Global slash commands synchronized!');
  } catch (error) {
    console.error('[Deploy Error]', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Runtime Crash] /${interaction.commandName}:`, error);
    const replyPayload = { content: '❌ There was an internal error executing this command!', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(replyPayload);
    } else {
      await interaction.reply(replyPayload);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);