// Inclawbator Discord Bot — thin bridge to agent-chat API
// Anyone can add this bot to their server. All capabilities come from the Inclawbator brain.
// When agent-chat gets updated, this bot automatically gets the new capabilities.

import { Client, GatewayIntentBits, Events, EmbedBuilder, ActivityType } from 'discord.js';

// ── Config ──

const AGENT_CHAT_URL = process.env.AGENT_CHAT_URL || 'https://www.inclawbate.app/api/inclawbate/agent-chat';
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const MAX_REPLY_LENGTH = 2000; // Discord message limit

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN env var');
  process.exit(1);
}

// ── Agent Chat Bridge ──

// Session per channel so conversations have context
const channelSessions = new Map();

function getSession(channelId) {
  if (!channelSessions.has(channelId)) {
    channelSessions.set(channelId, `discord-${channelId}-${Date.now().toString(36)}`);
  }
  return channelSessions.get(channelId);
}

async function askInclawbator(message, channelId, wallet) {
  const body = {
    message,
    session_id: getSession(channelId),
  };
  if (wallet) body.wallet = wallet;

  try {
    const resp = await fetch(AGENT_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      console.error(`agent-chat returned ${resp.status}`);
      return 'Something went wrong — try again in a moment.';
    }

    const data = await resp.json();
    return data.reply || 'No response — try rephrasing your question.';
  } catch (err) {
    console.error('agent-chat error:', err.message);
    return 'Could not reach the Inclawbator brain — try again in a moment.';
  }
}

// ── Format Response ──

function formatReply(text) {
  // If short enough, return as-is
  if (text.length <= MAX_REPLY_LENGTH) return [text];

  // Split into chunks at natural break points
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_REPLY_LENGTH) {
      chunks.push(remaining);
      break;
    }
    // Find last newline before limit
    let splitAt = remaining.lastIndexOf('\n', MAX_REPLY_LENGTH);
    if (splitAt < 200) splitAt = MAX_REPLY_LENGTH; // no good break, hard cut
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

// ── Discord Client ──

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once(Events.ClientReady, (c) => {
  console.log(`Inclawbator Discord bot online as ${c.user.tag}`);
  console.log(`In ${c.guilds.cache.size} server(s)`);

  c.user.setActivity('inclawbate.app', { type: ActivityType.Watching });
});

// ── Slash Commands ──

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;
  await interaction.deferReply();

  let message = '';

  if (commandName === 'build') {
    const name = options.getString('name');
    const description = options.getString('description');
    message = `Build me an app called "${name}". ${description}`;
  } else if (commandName === 'launch') {
    const name = options.getString('name');
    const symbol = options.getString('symbol');
    const wallet = options.getString('wallet');
    message = `Launch a token called ${name} with symbol ${symbol}`;
    if (wallet) message += ` to wallet ${wallet}`;
  } else if (commandName === 'chat') {
    message = options.getString('message');
  } else if (commandName === 'stake') {
    const token = options.getString('token');
    message = `Show me staking stats${token ? ` for ${token}` : ''}`;
  } else if (commandName === 'info') {
    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('The Inclawbator')
      .setDescription('AI agent that helps you build, launch, and grow crypto projects on Base.')
      .addFields(
        { name: 'Build', value: '`/build` — Create a live web app with AI', inline: true },
        { name: 'Launch', value: '`/launch` — Launch a token on Base', inline: true },
        { name: 'Stake', value: '`/stake` — Check staking stats', inline: true },
        { name: 'Chat', value: '`/chat` — Ask anything', inline: true },
      )
      .setFooter({ text: 'inclawbate.app — Anyone Can Build. Everyone Gets Paid.' })
      .setURL('https://inclawbate.app/inclawbator');

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (!message) {
    await interaction.editReply('Missing input — try again.');
    return;
  }

  // Extract wallet if present in any message
  const walletMatch = message.match(/0x[a-fA-F0-9]{40}/);
  const reply = await askInclawbator(message, interaction.channelId, walletMatch?.[0]);

  const chunks = formatReply(reply);
  await interaction.editReply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp(chunks[i]);
  }
});

// ── @mention / reply handling ──

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  // Only respond when mentioned or in a DM
  const mentioned = message.mentions.has(client.user);
  const isDM = !message.guild;

  if (!mentioned && !isDM) return;

  // Strip the mention from the message
  let content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    content = 'Hey, what can you do?';
  }

  await message.channel.sendTyping();

  const walletMatch = content.match(/0x[a-fA-F0-9]{40}/);
  const reply = await askInclawbator(content, message.channelId, walletMatch?.[0]);

  const chunks = formatReply(reply);
  for (const chunk of chunks) {
    await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
  }
});

// ── Health check server (for Railway) ──

import http from 'http';

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bot: client.user?.tag || 'starting',
      guilds: client.guilds?.cache.size || 0,
      uptime: Math.floor(process.uptime())
    }));
  } else {
    res.writeHead(200);
    res.end('Inclawbator Discord Bot');
  }
}).listen(PORT, () => console.log(`Health check on :${PORT}`));

// ── Start ──

client.login(DISCORD_TOKEN);
