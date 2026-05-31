const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('football')
        .setDescription('GoalWire Master Dashboard')
        // Add your 10 subcommands here
        .addSubcommand(sub => sub.setName('scorers').setDescription('View top scorers'))
        .addSubcommand(sub => sub.setName('fixtures').setDescription('View fixtures'))
        .addSubcommand(sub => sub.setName('results').setDescription('View results'))
        .addSubcommand(sub => sub.setName('table').setDescription('View standings'))
        .addSubcommand(sub => sub.setName('live').setDescription('View live matches'))
        .addSubcommand(sub => sub.setName('team').setDescription('View team profile'))
        .addSubcommand(sub => sub.setName('player').setDescription('View player stats'))
        .addSubcommand(sub => sub.setName('injuries').setDescription('Check injury reports'))
        .addSubcommand(sub => sub.setName('form').setDescription('Check recent form'))
        .addSubcommand(sub => sub.setName('set-channel')
            .setDescription('Set the channel for automated updates')
            .addChannelOption(o => o.setName('channel').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set-channel') {
            const channel = interaction.options.getChannel('channel');
            // Logic to save channel.id to your database goes here
            await interaction.reply(`Updates will now be sent to ${channel}.`);
        } else {
            // Handle other subcommands using if/else or switch statements
            await interaction.reply(`You selected: ${sub}`);
        }
    },
};