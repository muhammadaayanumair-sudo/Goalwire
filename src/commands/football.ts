const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('football')
        .setDescription('GoalWire Master Dashboard')
        .addSubcommand(sub => sub.setName('scorers').setDescription('Show top scorers'))
        .addSubcommand(sub => sub.setName('fixtures').setDescription('Show upcoming fixtures'))
        .addSubcommand(sub => sub.setName('results').setDescription('Show recent results'))
        .addSubcommand(sub => sub.setName('table').setDescription('Show league table'))
        .addSubcommand(sub => sub.setName('live').setDescription('Show live matches'))
        .addSubcommand(sub => sub.setName('team').setDescription('Show team info'))
        .addSubcommand(sub => sub.setName('player').setDescription('Show player info'))
        .addSubcommand(sub => sub.setName('injuries').setDescription('Show injury news'))
        .addSubcommand(sub => sub.setName('form').setDescription('Show team form'))
        .addSubcommand(sub => sub.setName('set-channel').setDescription('Set notification channel')
            .addChannelOption(o => o.setName('channel').setDescription('The channel to set').setRequired(true))
        ),

    async execute(interaction: any) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set-channel') {
            const channel = interaction.options.getChannel('channel');
            // Add your database logic here later
            await interaction.reply(`Updates will now be sent to ${channel.name}`);
        } else {
            await interaction.reply(`You selected: ${sub}`);
        }
    },
};