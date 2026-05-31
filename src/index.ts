import { Client, GatewayIntentBits, Collection, REST, Routes, ChatInputCommandInteraction } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = new Collection<string, any>();

// 1. LOADER ENGINE - Automatically syncs valid files
const commandNames = ['football'];

for (const name of commandNames) {
  try {
    const cmd = require(`./commands/${name}`);
    if (cmd && cmd.data && cmd.execute) {
      commands.set(cmd.data.name, cmd);
      console.log(`[System Sync] Loaded command structure: /${cmd.data.name}`);
    }
  } catch (error: any) {
    console.log(`[System Info] Command /${name} skipped.`);
  }
}

// 2. CACHE-BUSTING DEPLOYMENT CYCLE
client.once('ready', async () => {
  if (!client.user) return;
  console.log(`[Bot Online] Authenticated as ${client.user.tag}`);
  
  const token = process.env.DISCORD_TOKEN;
  const clientId = client.user.id;
  
  if (!token || !clientId) {
    console.error('[Deploy Error] Missing system tokens.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('[Deploy] Clearing stale states & rewriting global application commands...');
    
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
    
    // This forces Discord to completely wipe out any ghost parameters or dead menu layers
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    
    console.log('[Deploy] New command configurations pushed globally successfully!');
  } catch (err: any) {
    console.error('[Deploy Sync Error]', err.message);
  }
});

// 3. RUNTIME EXECUTION INTERCEPTOR
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error: any) {
    console.error(`[Runtime Error] /${interaction.commandName}:`, error);
    const errText = `❌ Command Error: \`${error?.message || 'Data structure alignment crash.'}\``;
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errText }).catch(() => {});
    } else {
      await interaction.reply({ content: errText, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);