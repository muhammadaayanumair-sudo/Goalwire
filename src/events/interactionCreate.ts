import { Interaction } from 'discord.js';
import { commands } from '../index';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Execution Error] /${interaction.commandName}:`, error);
    const msg = { content: '❌ There was an internal error executing this command!', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
}