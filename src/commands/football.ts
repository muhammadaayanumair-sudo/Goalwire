// Add this import at the top
const { SlashCommandBuilder, SlashCommandSubcommandBuilder } = require('discord.js');

// ...

data: new SlashCommandBuilder()
    .setName('football')
    .setDescription('GoalWire Master Dashboard')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('scorers').setDescription('Show top scorers'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('fixtures').setDescription('Show upcoming fixtures'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('results').setDescription('Show recent results'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('table').setDescription('Show league table'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('live').setDescription('Show live matches'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('team').setDescription('Show team info'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('player').setDescription('Show player info'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('injuries').setDescription('Show injury news'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('form').setDescription('Show team form'))
    .addSubcommand((sub: SlashCommandSubcommandBuilder) => sub.setName('set-channel').setDescription('Set notification channel')
        .addChannelOption((o: any) => o.setName('channel').setDescription('The channel to set').setRequired(true))
    ),