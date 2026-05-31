import { Client, GatewayIntentBits } from 'discord.js';
import './tasks/matchNotifier'; // Imports the task to start it

export const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
});

client.once('ready', () => {
    console.log(`GoalWire is online as ${client.user?.tag}`);
});

client.login(process.env.DISCORD_TOKEN);