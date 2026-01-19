// SUITE Hub Bot - Telegram Webhook Handler
// Handles wallet <-> telegram linking

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

    // Handle /start command
    if (update.message?.text?.startsWith('/start')) {
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
