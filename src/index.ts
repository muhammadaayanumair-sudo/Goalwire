import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
export const commands = new Collection<string, any>();

// 1. LOAD COMMANDS
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      commands.set(command.data.name, command);
    }
  }
}

// 2. LOAD MODULAR EVENTS
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

client.login(process.env.DISCORD_TOKEN);