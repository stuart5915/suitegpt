// Register slash commands globally for the Inclawbator Discord bot
// Run once: DISCORD_BOT_TOKEN=xxx DISCORD_APP_ID=xxx node register-commands.js

import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APP_ID = process.env.DISCORD_APP_ID;

if (!TOKEN || !APP_ID) {
  console.error('Set DISCORD_BOT_TOKEN and DISCORD_APP_ID env vars');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('build')
    .setDescription('Build a live web app with AI')
    .addStringOption(o => o.setName('name').setDescription('Short name for the app URL').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('What should it look like and do?').setRequired(true)),

  new SlashCommandBuilder()
    .setName('launch')
    .setDescription('Launch a token on Base')
    .addStringOption(o => o.setName('name').setDescription('Token name').setRequired(true))
    .addStringOption(o => o.setName('symbol').setDescription('Token ticker/symbol').setRequired(true))
    .addStringOption(o => o.setName('wallet').setDescription('Your wallet address (receives 80% LP fees)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('stake')
    .setDescription('Check staking stats')
    .addStringOption(o => o.setName('token').setDescription('Token address (optional)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Chat with the Inclawbator')
    .addStringOption(o => o.setName('message').setDescription('Your message').setRequired(true)),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Learn what the Inclawbator can do'),
];

const rest = new REST().setToken(TOKEN);

try {
  console.log('Registering slash commands globally...');
  const data = await rest.put(
    Routes.applicationCommands(APP_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log(`Registered ${data.length} commands.`);
} catch (err) {
  console.error('Failed:', err);
}
