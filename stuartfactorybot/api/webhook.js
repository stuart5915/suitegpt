// StuartFactoryBot - Simple NoteBox Capture
// Send message → Pick category → Saved
// Now with category management!

const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();

// Only allow Stuart
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '').split(',').filter(Boolean);

// Default categories (used if none in database)
const DEFAULT_CATEGORIES = {
  brainstorm: { emoji: '💭', label: 'Brainstorm' },
  suite_business: { emoji: '💰', label: 'Business' },
  action_item: { emoji: '✅', label: 'Action' },
  personal: { emoji: '🏠', label: 'Personal' },
  app_idea: { emoji: '💡', label: 'App Idea' },
  suite_feature: { emoji: '⚡', label: 'SUITE' },
  article: { emoji: '📝', label: 'Article' },
  question: { emoji: '❓', label: 'Question' }
};

// Pending messages waiting for category selection
const pendingMessages = new Map();

// ═══════════════════════════════════════════════════════════════
// TELEGRAM HELPERS
// ═══════════════════════════════════════════════════════════════

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

async function answerCallback(callbackId, text = '') {
  const fetch = (await import('node-fetch')).default;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text })
  });
}

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

// ═══════════════════════════════════════════════════════════════
// SUPABASE HELPERS
// ═══════════════════════════════════════════════════════════════

async function getCategories(userId) {
  const fetch = (await import('node-fetch')).default;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/notebox_categories?user_id=eq.tg_${userId}&order=sort_order.asc`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (response.ok) {
      const cats = await response.json();
      if (cats.length > 0) {
        // Convert to object format
        const result = {};
        cats.forEach(c => {
          result[c.slug] = { emoji: c.emoji, label: c.label };
        });
        return result;
      }
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }

  // Return defaults if no custom categories
  return DEFAULT_CATEGORIES;
}

async function addCategory(userId, slug, emoji, label) {
  const fetch = (await import('node-fetch')).default;

  // Get current max sort_order
  const catsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/notebox_categories?user_id=eq.tg_${userId}&order=sort_order.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  let sortOrder = 0;
  if (catsResponse.ok) {
    const existing = await catsResponse.json();
    if (existing.length > 0) {
      sortOrder = (existing[0].sort_order || 0) + 1;
    }
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/notebox_categories`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: `tg_${userId}`,
      slug: slug,
      emoji: emoji,
      label: label,
      sort_order: sortOrder
    })
  });

  return response.ok;
}

async function removeCategory(userId, slug) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/notebox_categories?user_id=eq.tg_${userId}&slug=eq.${slug}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  return response.ok;
}

async function initializeUserCategories(userId) {
  const fetch = (await import('node-fetch')).default;

  // Check if user has any categories
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/notebox_categories?user_id=eq.tg_${userId}&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (checkResponse.ok) {
    const existing = await checkResponse.json();
    if (existing.length > 0) return; // Already has categories
  }

  // Initialize with defaults
  const entries = Object.entries(DEFAULT_CATEGORIES);
  for (let i = 0; i < entries.length; i++) {
    const [slug, cat] = entries[i];
    await addCategory(userId, slug, cat.emoji, cat.label);
  }
}

async function saveToNoteBox(userId, category, rawMessage) {
  const fetch = (await import('node-fetch')).default;

  // Generate title from message
  const title = rawMessage.length > 60
    ? rawMessage.substring(0, 60) + '...'
    : rawMessage;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/personal_ideas`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      raw_input: rawMessage,
      category: category,
      title: title,
      content: rawMessage.length > 60 ? rawMessage : '',
      status: 'inbox',
      user_id: `tg_${userId}`
    })
  });

  return response.ok;
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleNewMessage(chatId, userId, text) {
  // Store the message temporarily
  pendingMessages.set(String(chatId), {
    text,
    userId,
    timestamp: Date.now()
  });

  // Get user's categories
  const categories = await getCategories(userId);

  // Build category buttons (2 per row)
  const categoryKeys = Object.keys(categories);
  const keyboard = [];

  for (let i = 0; i < categoryKeys.length; i += 2) {
    const row = [];
    const key1 = categoryKeys[i];
    const cat1 = categories[key1];
    row.push({ text: `${cat1.emoji} ${cat1.label}`, callback_data: `cat|${key1}` });

    if (categoryKeys[i + 1]) {
      const key2 = categoryKeys[i + 1];
      const cat2 = categories[key2];
      row.push({ text: `${cat2.emoji} ${cat2.label}`, callback_data: `cat|${key2}` });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: '⚙️ Manage', callback_data: 'manage_cats' },
    { text: '❌ Cancel', callback_data: 'cancel' }
  ]);

  await sendMessage(chatId, '📁 *Where should this go?*', {
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handleCategorySelect(chatId, userId, category) {
  const pending = pendingMessages.get(String(chatId));

  if (!pending) {
    await sendMessage(chatId, '❌ No pending message. Send something first!');
    return;
  }

  // Get categories for label
  const categories = await getCategories(userId);

  // Save to NoteBox
  const success = await saveToNoteBox(pending.userId, category, pending.text);

  // Clear pending
  pendingMessages.delete(String(chatId));

  if (success) {
    const cat = categories[category] || { emoji: '📁', label: category };
    await sendMessage(chatId, `✅ Saved to *${cat.emoji} ${cat.label}*`);
  } else {
    await sendMessage(chatId, '❌ Failed to save. Try again.');
  }
}

async function showManageCategories(chatId, messageId, userId) {
  const categories = await getCategories(userId);

  let text = '⚙️ *Manage Categories*\n\n';
  text += 'Current categories:\n';
  Object.entries(categories).forEach(([slug, cat]) => {
    text += `${cat.emoji} ${cat.label} (\`${slug}\`)\n`;
  });
  text += '\n*Commands:*\n';
  text += '`/addcat 🎯 Goals` - Add category\n';
  text += '`/removecat goals` - Remove category';

  const keyboard = [
    [{ text: '➕ Add Category', callback_data: 'add_cat_help' }],
    [{ text: '➖ Remove Category', callback_data: 'remove_cat_menu' }],
    [{ text: '🔙 Back', callback_data: 'back_to_cats' }]
  ];

  if (messageId) {
    await editMessage(chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard }
    });
  } else {
    await sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

async function showRemoveCategoryMenu(chatId, messageId, userId) {
  const categories = await getCategories(userId);

  const keyboard = Object.entries(categories).map(([slug, cat]) => {
    return [{ text: `🗑️ ${cat.emoji} ${cat.label}`, callback_data: `rmcat|${slug}` }];
  });

  keyboard.push([{ text: '🔙 Back', callback_data: 'manage_cats' }]);

  await editMessage(chatId, messageId, '🗑️ *Select category to remove:*', {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ═══════════════════════════════════════════════════════════════
// CALLBACK HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;

  await answerCallback(query.id);

  // Category selection
  if (data.startsWith('cat|')) {
    const category = data.split('|')[1];
    await handleCategorySelect(chatId, userId, category);
    return;
  }

  // Remove category
  if (data.startsWith('rmcat|')) {
    const slug = data.split('|')[1];
    const success = await removeCategory(userId, slug);
    if (success) {
      await answerCallback(query.id, '✅ Removed!');
      await showManageCategories(chatId, messageId, userId);
    } else {
      await sendMessage(chatId, '❌ Failed to remove category');
    }
    return;
  }

  // Manage categories
  if (data === 'manage_cats') {
    await showManageCategories(chatId, messageId, userId);
    return;
  }

  // Add category help
  if (data === 'add_cat_help') {
    await editMessage(chatId, messageId,
      '➕ *Add a Category*\n\n' +
      'Send a message like:\n' +
      '`/addcat 🎯 Goals`\n\n' +
      'Format: `/addcat [emoji] [Name]`',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'manage_cats' }]] }}
    );
    return;
  }

  // Remove category menu
  if (data === 'remove_cat_menu') {
    await showRemoveCategoryMenu(chatId, messageId, userId);
    return;
  }

  // Back to category selection
  if (data === 'back_to_cats') {
    const pending = pendingMessages.get(String(chatId));
    if (pending) {
      // Re-show category selection
      const categories = await getCategories(userId);
      const categoryKeys = Object.keys(categories);
      const keyboard = [];

      for (let i = 0; i < categoryKeys.length; i += 2) {
        const row = [];
        const key1 = categoryKeys[i];
        const cat1 = categories[key1];
        row.push({ text: `${cat1.emoji} ${cat1.label}`, callback_data: `cat|${key1}` });

        if (categoryKeys[i + 1]) {
          const key2 = categoryKeys[i + 1];
          const cat2 = categories[key2];
          row.push({ text: `${cat2.emoji} ${cat2.label}`, callback_data: `cat|${key2}` });
        }
        keyboard.push(row);
      }

      keyboard.push([
        { text: '⚙️ Manage', callback_data: 'manage_cats' },
        { text: '❌ Cancel', callback_data: 'cancel' }
      ]);

      await editMessage(chatId, messageId, '📁 *Where should this go?*', {
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await editMessage(chatId, messageId, '✅ Done managing categories.\n\nSend me a message to save!', {
        reply_markup: { inline_keyboard: [] }
      });
    }
    return;
  }

  // Cancel
  if (data === 'cancel') {
    pendingMessages.delete(String(chatId));
    await editMessage(chatId, messageId, '❌ Cancelled', {
      reply_markup: { inline_keyboard: [] }
    });
    return;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN WEBHOOK
// ═══════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('NoteBox Bot running!');
  }

  try {
    const update = req.body;

    // Handle messages
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const text = update.message.text;

      // Check authorization
      if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(String(userId))) {
        await sendMessage(chatId, '🔒 Private bot');
        return res.status(200).send('OK');
      }

      // Handle /start
      if (text === '/start') {
        // Initialize categories for new user
        await initializeUserCategories(userId);
        await sendMessage(chatId,
          '📝 *NoteBox Bot*\n\n' +
          'Send me anything and pick a category to save it.\n\n' +
          '*Commands:*\n' +
          '/categories - Manage categories\n' +
          '/addcat 🎯 Name - Add category\n' +
          '/removecat slug - Remove category'
        );
        return res.status(200).send('OK');
      }

      // Handle /cancel
      if (text === '/cancel') {
        pendingMessages.delete(String(chatId));
        await sendMessage(chatId, '✅ Cancelled');
        return res.status(200).send('OK');
      }

      // Handle /categories
      if (text === '/categories') {
        await showManageCategories(chatId, null, userId);
        return res.status(200).send('OK');
      }

      // Handle /addcat
      if (text.startsWith('/addcat ')) {
        const parts = text.slice(8).trim();
        // Extract emoji and label: "🎯 Goals" -> emoji="🎯", label="Goals"
        const match = parts.match(/^(\S+)\s+(.+)$/);
        if (match) {
          const emoji = match[1];
          const label = match[2].trim();
          const slug = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

          if (slug) {
            // Initialize categories first if needed
            await initializeUserCategories(userId);
            const success = await addCategory(userId, slug, emoji, label);
            if (success) {
              await sendMessage(chatId, `✅ Added category: ${emoji} ${label}`);
            } else {
              await sendMessage(chatId, '❌ Failed to add category. Maybe it already exists?');
            }
          } else {
            await sendMessage(chatId, '❌ Invalid category name');
          }
        } else {
          await sendMessage(chatId, '❌ Usage: `/addcat 🎯 Goals`');
        }
        return res.status(200).send('OK');
      }

      // Handle /removecat
      if (text.startsWith('/removecat ')) {
        const slug = text.slice(11).trim().toLowerCase();
        if (slug) {
          const success = await removeCategory(userId, slug);
          if (success) {
            await sendMessage(chatId, `✅ Removed category: ${slug}`);
          } else {
            await sendMessage(chatId, '❌ Category not found');
          }
        } else {
          await sendMessage(chatId, '❌ Usage: `/removecat slug`');
        }
        return res.status(200).send('OK');
      }

      // Process new message
      await handleNewMessage(chatId, userId, text);
      return res.status(200).send('OK');
    }

    // Handle button presses
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return res.status(200).send('OK');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK');
  }
};
