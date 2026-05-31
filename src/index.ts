import { Client, GatewayIntentBits, Collection, REST, Routes, ChatInputCommandInteraction } from 'discord.js';
import * as path from 'path';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = new Collection<string, any>();

// 1. MANUALLY REQUIRE YOUR FOOTBALL COMMAND (Zero folder loops, zero loading bugs!)
try {
  const footballCommand = require('./commands/football');
  if (footballCommand && footballCommand.data) {
    commands.set(footballCommand.data.name, footballCommand);
    console.log(`[System] Clean loaded command: /${footballCommand.data.name}`);
  }
} catch (e: any) {
  console.error('[System Error] Could not find or read commands/football.ts:', e.message);
}

// 2. STABLE BOT STARTUP (Uses clientReady to fix the warning in IMG_2262.png!)
client.once('clientReady', async (c) => {
  console.log(`[Bot Online] Logged in as ${c.user?.tag}`);
  
  const token = process.env.DISCORD_TOKEN;
  const clientId = c.user?.id;
  if (!token || !clientId) {
    console.error('[Deploy Error] Missing environment tokens.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('[Deploy] Forcing command sync with Discord servers...');
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log('[Deploy] Slash commands synchronized perfectly!');
  } catch (error) {
    console.error('[Deploy Sync Error]', error);
  }
});

// Fallback for older library versions just in case
client.once('ready', () => {
  if (!client.user) return;
  console.log(`[Bot Online Fallback] Logged in as ${client.user.tag}`);
});

// 3. STABLE INTERACTION CREATOR
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error: any) {
    console.error(`[Runtime Error] Error running /${interaction.commandName}:`, error);
    const msg = { content: `❌ Command Error: ${error?.message || 'Unknown processing crash'}`, ephemeral: true };
    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);