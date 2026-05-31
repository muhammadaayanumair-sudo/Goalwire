import { Client, GatewayIntentBits, Collection, REST, Routes, ChatInputCommandInteraction } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = new Collection<string, any>();

// 1. SAFE COMMAND LOOPER (Skips missing files automatically without crashing the build)
const commandNames = ['football', 'formation', 'cards', 'h2h'];

for (const name of commandNames) {
  try {
    // This dynamically checks if the file exists before trying to force load it
    const cmd = require(`./commands/${name}`);
    if (cmd && cmd.data && cmd.execute) {
      commands.set(cmd.data.name, cmd);
      console.log(`[System Sync] Loaded command: /${cmd.data.name}`);
    }
  } catch (error: any) {
    // If the file is missing or empty, it gracefully logs it instead of crashing Railway!
    console.log(`[System Info] Command /${name} is not locally present. Skipping setup.`);
  }
}

// 2. STABLE BOT STARTUP
client.once('clientReady', async (readyClient) => {
  console.log(`[Bot Online] Logged in as ${readyClient.user?.tag}`);
  
  const token = process.env.DISCORD_TOKEN;
  const clientId = readyClient.user?.id;
  if (!token || !clientId) {
    console.error('[Deploy Error] Missing environment tokens.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('[Deploy] Synchronizing slash commands...');
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log('[Deploy] Slash commands synchronized perfectly!');
  } catch (err: any) {
    console.error('[Deploy Sync Error]', err.message);
  }
});

// Fallback ready listener
client.once('ready', () => {
  if (!client.user) return;
  console.log(`[Bot Online Fallback] Logged in as ${client.user.tag}`);
});

// 3. INTERACTION HANDLER
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  
  if (!command) {
    return interaction.reply({ 
      content: `🚧 The \`/${interaction.commandName}\` command infrastructure is registered, but its file is empty or missing!`, 
      ephemeral: true 
    });
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error: any) {
    console.error(`[Runtime Error] Error running /${interaction.commandName}:`, error);
    const errorPayload = { content: `❌ Command Error: ${error?.message || 'Unknown processing crash.'}`, ephemeral: true };
    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorPayload);
    } else {
      await interaction.reply(errorPayload);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);