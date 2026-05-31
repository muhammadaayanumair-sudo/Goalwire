const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('football')
        .setDescription('GoalWire Master Dashboard')
        .addSubcommand(sub => sub.setName('scorers').setDescription('View top scorers'))
        .addSubcommand(sub => sub.setName('fixtures').setDescription('View upcoming matches'))
        .addSubcommand(sub => sub.setName('results').setDescription('View recent results'))
        .addSubcommand(sub => sub.setName('table').setDescription('View league standings'))
        .addSubcommand(sub => sub.setName('live').setDescription('View live matches'))
        .addSubcommand(sub => sub.setName('team').setDescription('View team profile'))
        .addSubcommand(sub => sub.setName('player').setDescription('View player stats'))
        .addSubcommand(sub => sub.setName('injuries').setDescription('Check injury reports'))
        .addSubcommand(sub => sub.setName('form').setDescription('Check team form'))
        .addSubcommand(sub => 
            sub.setName('set-channel')
               .setDescription('Set the channel for live updates')
               .addChannelOption(o => o.setName('channel').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        
        if (sub === 'set-channel') {
            const channel = interaction.options.getChannel('channel');
            // Save 'channel.id' to your database here to persist settings
            await interaction.reply(`Live updates will now be sent to ${channel}.`);
        } else {
            // Handle other commands (scorers, fixtures, etc.)
            await interaction.reply(`You selected: ${sub}`);
        }
    },
};