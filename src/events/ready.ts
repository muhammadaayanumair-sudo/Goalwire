import { Client, REST, Routes } from 'discord.js';
import { commands } from '../index';

export const name = 'ready';
export const once = true;

export async function execute(client: Client) {
  console.log(`[Bot Ready] Logged in as ${client.user?.tag}`);

  const token = process.env.DISCORD_TOKEN;
  const clientId = client.user?.id;
  if (!token || !clientId) {
    console.error('[Deploy Error] Missing environment tokens.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('[Deploy] Refreshing global slash commands...');
    const commandData = commands.map((cmd: any) => cmd.data.toJSON());
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log('[Deploy] Successfully reloaded all slash commands globally!');
  } catch (error) {
    console.error('[Deploy Error]', error);
  }
}