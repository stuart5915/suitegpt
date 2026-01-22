// SUITE Hub Bot - Telegram Webhook Handler
// Handles wallet <-> telegram linking AND community management

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// SUITE info for AI context
const SUITE_CONTEXT = `
SUITE is a decentralized app ecosystem where Anyone Can Build and Everyone Gets Paid.

Key Features:
- **Credits System**: Buy credits to use AI features across all SUITE apps. 1000 credits = $1.
- **Governance**: Vote on proposals, submit ideas, earn reputation in the Factory.
- **Apps**: TrueForm (fitness AI), Cadence AI (social media), OptiRep (workouts), RemCast (dream journal), Cheshbon (daily reflection), and more.
- **AI Fleet**: Every app is powered by AI assistants that help users.

Website: getsuite.app
Factory (governance): getsuite.app/factory.html
Apps: getsuite.app/#apps

How to get started:
1. Connect your wallet at getsuite.app
2. Buy credits in your profile
3. Use any SUITE app
4. Earn reputation by participating in governance
`;

// Send message via Telegram API
async function sendMessage(chatId, text, options = {}) {
  const fetch = (await import('node-fetch')).default;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options
    })
  });
}

// Edit message
async function editMessage(chatId, messageId, text, options = {}) {
  const fetch = (await import('node-fetch')).default;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      ...options
    })
  });
}

// Answer callback query
async function answerCallback(callbackId, text) {
  const fetch = (await import('node-fetch')).default;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text
    })
  });
}

// AI chat using Gemini
async function askAI(question) {
  if (!GEMINI_API_KEY) return null;

  const fetch = (await import('node-fetch')).default;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are SUITE Bot, a helpful assistant for the SUITE ecosystem. Answer questions concisely (max 200 words) based on this context:

${SUITE_CONTEXT}

User question: ${question}

If the question is not related to SUITE, politely redirect them to ask about SUITE apps, credits, or governance. Be friendly and use emojis occasionally.`
            }]
          }]
        })
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error('AI error:', err);
    return null;
  }
}

// Link telegram to wallet in Supabase
async function linkTelegramToWallet(walletAddress, telegramId, telegramUsername) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/suite_credits?wallet_address=eq.${walletAddress.toLowerCase()}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        linked_telegram_id: String(telegramId),
        linked_telegram_username: `@${telegramUsername}`
      })
    }
  );
  return response.ok;
}

// Main webhook handler
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('SUITE Hub Bot is running!');
  }

  try {
    const update = req.body;
    const message = update.message;
    const chatType = message?.chat?.type; // 'private', 'group', 'supergroup'
    const isGroup = chatType === 'group' || chatType === 'supergroup';

    // Handle new members joining a group
    if (message?.new_chat_members) {
      const chatId = message.chat.id;
      for (const member of message.new_chat_members) {
        if (!member.is_bot) {
          const name = member.first_name || 'friend';
          await sendMessage(chatId,
            `👋 Welcome to SUITE, ${name}!\n\n` +
            `🚀 *Quick Start:*\n` +
            `• Visit [getsuite.app](https://getsuite.app) to explore\n` +
            `• Check out our [apps](https://getsuite.app/#apps)\n` +
            `• Join [governance](https://getsuite.app/factory.html) to vote on ideas\n\n` +
            `Type /help to see what I can do!`
          );
        }
      }
      return res.status(200).send('OK');
    }

    // Handle commands
    if (message?.text?.startsWith('/help')) {
      const chatId = message.chat.id;
      await sendMessage(chatId,
        `🤖 *SUITE Bot Commands*\n\n` +
        `/help - Show this message\n` +
        `/apps - Browse SUITE apps\n` +
        `/credits - Learn about credits\n` +
        `/governance - How to participate\n` +
        `/ask <question> - Ask me anything about SUITE\n\n` +
        `Or just ask me a question directly!`
      );
      return res.status(200).send('OK');
    }

    if (message?.text?.startsWith('/apps')) {
      const chatId = message.chat.id;
      await sendMessage(chatId,
        `📱 *SUITE Apps*\n\n` +
        `🏋️ *TrueForm* - AI posture & movement analysis\n` +
        `🎯 *Cadence AI* - Social media engagement assistant\n` +
        `💪 *OptiRep* - AI workout trainer\n` +
        `🌙 *RemCast* - Dream journal & interpretation\n` +
        `📝 *Cheshbon* - Daily reflection & growth\n\n` +
        `Browse all apps: [getsuite.app/#apps](https://getsuite.app/#apps)`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🚀 Explore Apps', url: 'https://getsuite.app/#apps' }
            ]]
          }
        }
      );
      return res.status(200).send('OK');
    }

    if (message?.text?.startsWith('/credits')) {
      const chatId = message.chat.id;
      await sendMessage(chatId,
        `💳 *SUITE Credits*\n\n` +
        `Credits power all AI features across SUITE apps.\n\n` +
        `*Pricing:*\n` +
        `• 1,000 credits = $1\n` +
        `• 5,000 credits = $4 (20% bonus)\n` +
        `• 10,000 credits = $7 (40% bonus)\n\n` +
        `*How to get credits:*\n` +
        `1. Connect wallet at getsuite.app\n` +
        `2. Go to your Profile\n` +
        `3. Buy credits with crypto\n\n` +
        `Credits work across ALL SUITE apps!`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '💰 Buy Credits', url: 'https://getsuite.app/profile.html' }
            ]]
          }
        }
      );
      return res.status(200).send('OK');
    }

    if (message?.text?.startsWith('/governance')) {
      const chatId = message.chat.id;
      await sendMessage(chatId,
        `🏛️ *SUITE Governance*\n\n` +
        `Shape the future of SUITE!\n\n` +
        `*How it works:*\n` +
        `• Submit proposals for new features or apps\n` +
        `• Vote on community proposals\n` +
        `• Earn reputation for participating\n` +
        `• First vote on any proposal is FREE\n\n` +
        `*Sections:*\n` +
        `📱 Apps - Vote on new apps & features\n` +
        `💼 Business - Ecosystem decisions\n` +
        `📝 Articles - Content ideas\n` +
        `📣 Social - Marketing & community\n`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🗳️ Enter Factory', url: 'https://getsuite.app/factory.html?tab=governance' }
            ]]
          }
        }
      );
      return res.status(200).send('OK');
    }

    // Handle /ask command or direct questions (AI-powered)
    if (message?.text?.startsWith('/ask ') || (isGroup && message?.text?.toLowerCase().includes('suite'))) {
      const chatId = message.chat.id;
      const question = message.text.startsWith('/ask ')
        ? message.text.replace('/ask ', '').trim()
        : message.text;

      if (question.length < 3) {
        await sendMessage(chatId, '❓ Please ask a question! Example: `/ask How do credits work?`');
        return res.status(200).send('OK');
      }

      const answer = await askAI(question);
      if (answer) {
        await sendMessage(chatId, answer);
      } else {
        await sendMessage(chatId,
          `🤔 I couldn't process that. Try asking about:\n` +
          `• SUITE apps\n• Credits\n• Governance\n• How to get started`
        );
      }
      return res.status(200).send('OK');
    }

    // Handle /start command
    if (message?.text?.startsWith('/start')) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const username = update.message.from.username || 'user';
      const payload = update.message.text.replace('/start', '').trim();

      // Check if this is a wallet linking request
      if (payload.startsWith('link_')) {
        const walletAddress = payload.replace('link_', '').toLowerCase();

        // Validate wallet address
        if (!walletAddress.match(/^0x[a-f0-9]{40}$/i)) {
          await sendMessage(chatId, '❌ Invalid wallet address.');
          return res.status(200).send('OK');
        }

        // Send confirmation
        await sendMessage(chatId,
          `🔗 *Link Telegram to Wallet*\n\n` +
          `Wallet: \`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\`\n\n` +
          `This will allow you to:\n` +
          `• Access your credits via Telegram login\n` +
          `• Vote and submit ideas under @${username}\n\n` +
          `Confirm linking your Telegram account?`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Confirm Link', callback_data: `confirm_${walletAddress}` },
                { text: '❌ Cancel', callback_data: 'cancel_link' }
              ]]
            }
          }
        );
        return res.status(200).send('OK');
      }

      // Normal start message
      await sendMessage(chatId,
        `👋 *Welcome to SUITE Hub!*\n\n` +
        `This bot helps you link your Telegram account to your SUITE wallet.\n\n` +
        `To link, go to [getsuite.app](https://getsuite.app/suite-shell.html), ` +
        `connect your wallet, and click "Link Telegram".`
      );
      return res.status(200).send('OK');
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;
      const userId = query.from.id;
      const username = query.from.username || 'user';
      const data = query.data;

      if (data.startsWith('confirm_')) {
        const walletAddress = data.replace('confirm_', '');

        try {
          const success = await linkTelegramToWallet(walletAddress, userId, username);

          if (success) {
            await answerCallback(query.id, '✅ Linked!');
            await editMessage(chatId, messageId,
              `✅ *Successfully Linked!*\n\n` +
              `Your Telegram @${username} is now linked to wallet ` +
              `\`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\`\n\n` +
              `You can now login via Telegram on SUITE to access your credits.`,
              {
                reply_markup: {
                  inline_keyboard: [[
                    { text: '🚀 Return to SUITE', url: 'https://getsuite.app/suite-shell.html' }
                  ]]
                }
              }
            );
          } else {
            throw new Error('Update failed');
          }
        } catch (error) {
          console.error('Link error:', error);
          await answerCallback(query.id, '❌ Failed');
          await editMessage(chatId, messageId,
            `❌ *Failed to link*\n\n` +
            `Make sure you've connected this wallet on getsuite.app first.`
          );
        }
        return res.status(200).send('OK');
      }

      if (data === 'cancel_link') {
        await answerCallback(query.id, 'Cancelled');
        await editMessage(chatId, messageId, '❌ Linking cancelled.');
        return res.status(200).send('OK');
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to Telegram
  }
};
