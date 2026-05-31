import { Client, GatewayIntentBits, Collection, REST, Routes, ChatInputCommandInteraction } from 'discord.js';
import http from 'http';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = new Collection<string, any>();

// 🤖 KEEP-ALIVE SERVER: Keeps Railway from shutting your bot off!
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('GoalWire Bot Engine is Live and Running!');
}).listen(PORT, () => {
  console.log(`[Keep-Alive] Internal ping server listening on port ${PORT}`);
});

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

// 2. DEPLOYMENT CYCLE
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
    console.log('[Deploy] Synchronizing global application commands...');
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
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