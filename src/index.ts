import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// 1. Load Commands Dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

// 2. Handle Interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Error executing command!', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);