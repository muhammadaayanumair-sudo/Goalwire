import { Client, GatewayIntentBits, Collection, REST, Routes, ChatInputCommandInteraction, ActivityType } from 'discord.js';
import http from 'http';

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ] 
});
const commands = new Collection<string, any>();

// Keep-alive server for Railway stability
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('GoalWire Active Engine running smoothly');
}).listen(PORT);

const commandNames = ['football'];
for (const name of commandNames) {
  try {
    const cmd = require(`./commands/${name}`);
    if (cmd && cmd.data && cmd.execute) {
      commands.set(cmd.data.name, cmd);
    }
  } catch (error) {
    console.log(`Skipped loading: ${name}`);
  }
}

// 🟢 This block handles both 'ready' events to force the status dot to turn green
const handleReady = async () => {
  if (!client.user) return;
  console.log(`[Bot Online] Authenticated as ${client.user.tag}`);
  
  // Set profile status explicitly to online
  client.user.setPresence({
    status: 'online',
    activities: [{ name: '⚽ Football Live Tracker', type: ActivityType.Watching }]
  });

  const token = process.env.DISCORD_TOKEN;
  const clientId = client.user.id;
  if (!token || !clientId) return;

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log('[Deploy] Commands successfully pushed to Discord!');
  } catch (err) {
    console.error('[Deploy Error]', err);
  }
};

client.once('clientReady', handleReady);
client.once('ready', handleReady);

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error: any) {
    console.error(error);
    const errText = `❌ Processing Error: \`${error?.message || 'Data structure error.'}\``;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errText }).catch(() => {});
    } else {
      await interaction.reply({ content: errText, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);