// StuartFactoryBot - Personal Intake Webhook Handler
// Captures ideas via Telegram, classifies with AI, routes to Claude CLI

const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

// Only allow Stuart (set your Telegram user ID)
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '').split(',').filter(Boolean);

// ═══════════════════════════════════════════════════════════════
// TELEGRAM API HELPERS
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

async function answerCallback(callbackId, text = '') {
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

// ═══════════════════════════════════════════════════════════════
// SUPABASE HELPERS
// ═══════════════════════════════════════════════════════════════

async function supabaseRequest(method, endpoint, data = null) {
  const fetch = (await import('node-fetch')).default;
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
  };

  const options = { method, headers };
  if (data) options.body = JSON.stringify(data);

  const response = await fetch(url, options);

  if (method === 'GET' || method === 'POST') {
    return response.json();
  }
  return response.ok;
}

async function getDestinations() {
  return supabaseRequest('GET', 'intake_destinations?active=eq.true&order=sort_order');
}

async function getConversation(chatId) {
  const convs = await supabaseRequest('GET',
    `intake_conversations?telegram_chat_id=eq.${chatId}&status=neq.done&status=neq.cancelled&order=created_at.desc&limit=1`
  );
  return convs[0] || null;
}

async function createConversation(chatId, userId, username, rawMessage) {
  const convs = await supabaseRequest('POST', 'intake_conversations', {
    telegram_chat_id: String(chatId),
    telegram_user_id: String(userId),
    telegram_username: username,
    raw_message: rawMessage,
    status: 'classifying'
  });
  return convs[0];
}

async function updateConversation(convId, data) {
  return supabaseRequest('PATCH', `intake_conversations?id=eq.${convId}`, data);
}

// ═══════════════════════════════════════════════════════════════
// AI CLASSIFICATION (using Gemini Flash - FREE TIER!)
// ═══════════════════════════════════════════════════════════════

async function classifyMessage(message, destinations) {
  const fetch = (await import('node-fetch')).default;

  // Build destination descriptions for the prompt
  const destDescriptions = destinations.map(d =>
    `- ${d.slug}: ${d.name} - ${d.description}. Keywords: ${(d.keywords || []).join(', ')}`
  ).join('\n');

  const prompt = `You are classifying a message to route it to the correct destination.

Available destinations:
${destDescriptions}

Message to classify:
"${message}"

Respond with JSON only (no markdown, no code blocks):
{
  "destination_slug": "the best matching slug",
  "confidence": 0.0 to 1.0,
  "title": "extracted title/summary (brief)",
  "content": "the main content/details"
}`;

  try {
    // Using Gemini 1.5 Flash - free tier has 15 RPM, 1M TPM
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    );

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1] || jsonMatch[0];
    }

    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Classification error:', err);
  }

  // Fallback - use keyword matching
  const lowerMessage = message.toLowerCase();
  for (const dest of destinations) {
    const keywords = dest.keywords || [];
    if (keywords.some(kw => lowerMessage.includes(kw.toLowerCase()))) {
      return {
        destination_slug: dest.slug,
        confidence: 0.6,
        title: message.slice(0, 50),
        content: message
      };
    }
  }

  // Default fallback
  return {
    destination_slug: 'stuart',
    confidence: 0.5,
    title: message.slice(0, 50),
    content: message
  };
}

// ═══════════════════════════════════════════════════════════════
// PROMPT GENERATION
// ═══════════════════════════════════════════════════════════════

function generatePrompt(destination, title, content, answers) {
  let prompt = destination.prompt_template ||
    `New item for ${destination.name}:\n\nTitle: {title}\nContent: {content}`;

  // Replace placeholders
  prompt = prompt.replace(/\{title\}/g, title);
  prompt = prompt.replace(/\{content\}/g, content || '(no additional details)');

  // Replace answer placeholders
  for (const [key, value] of Object.entries(answers || {})) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  // Clean up any remaining placeholders
  prompt = prompt.replace(/\{[^}]+\}/g, '(not specified)');

  return prompt;
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATION STATE HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleNewMessage(chatId, userId, username, text) {
  try {
    // Check if there's an active conversation
    let conv = await getConversation(chatId);
    console.log('Existing conversation:', conv);

    if (conv) {
      // Continue existing conversation based on status
      return handleConversationResponse(chatId, conv, text);
    }

    // Start new conversation
    conv = await createConversation(chatId, userId, username, text);
    console.log('Created conversation:', conv);

    if (!conv || !conv.id) {
      console.error('Failed to create conversation');
      await sendMessage(chatId, "❌ Error: Could not create conversation. Please try again.");
      return;
    }

    // Classify the message
    const destinations = await getDestinations();
    console.log('Destinations:', destinations?.length || 0, 'found');

    if (!destinations || destinations.length === 0) {
      await sendMessage(chatId, "⚠️ No destinations configured yet. Please add destinations in Factory first.");
      await updateConversation(conv.id, { status: 'cancelled' });
      return;
    }

    const classification = await classifyMessage(text, destinations);
    console.log('Classification:', classification);

    // Find suggested destination (may not exist if AI suggests something new)
    let destination = destinations.find(d => d.slug === classification.destination_slug);

    // Get title with fallback
    const extractedTitle = classification.title || text.slice(0, 60) + (text.length > 60 ? '...' : '');

    // Update conversation with classification
    await updateConversation(conv.id, {
      detected_destination_id: destination?.id || null,
      confidence: classification.confidence,
      extracted_title: extractedTitle,
      extracted_content: classification.content || text,
      status: 'confirming_destination'
    });

    // Ask for destination confirmation
    const confidenceEmoji = destination
      ? (classification.confidence >= 0.8 ? '🎯' : classification.confidence >= 0.6 ? '🤔' : '❓')
      : '🤷';

    // Build destination buttons (show all, in rows of 2)
    // Use | delimiter to avoid issues with underscores in slugs
    const keyboard = [];
    for (let i = 0; i < destinations.length; i += 2) {
      const row = [{ text: `${destinations[i].icon} ${destinations[i].name}`, callback_data: `dest|${conv.id}|${destinations[i].slug}` }];
      if (destinations[i + 1]) {
        row.push({ text: `${destinations[i + 1].icon} ${destinations[i + 1].name}`, callback_data: `dest|${conv.id}|${destinations[i + 1].slug}` });
      }
      keyboard.push(row);
    }
    keyboard.push([{ text: '➕ Add New Destination', callback_data: `newdest|${conv.id}` }]);
    keyboard.push([{ text: '❌ Cancel', callback_data: `cancel|${conv.id}` }]);

    // Use the extracted title (already has fallback)
    const displayTitle = extractedTitle;

    const messageText = destination
      ? `${confidenceEmoji} *Got it!*\n\n` +
        `"${displayTitle}"\n\n` +
        `This looks like it's for *${destination.name}*.\n` +
        `Is that right, or should it go somewhere else?`
      : `${confidenceEmoji} *Got it!*\n\n` +
        `"${displayTitle}"\n\n` +
        `Where should this go?`;

    await sendMessage(chatId, messageText, {
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (err) {
    console.error('handleNewMessage error:', err);
    await sendMessage(chatId, `❌ Error processing message: ${err.message || 'Unknown error'}`);
  }
}

async function handleConversationResponse(chatId, conv, text) {
  // Content refinement flow
  if (conv.status === 'confirming_content') {
    return handleContentRefinement(chatId, conv, text);
  }

  if (conv.status === 'asking_questions') {
    // They're answering a question
    return handleQuestionAnswer(chatId, conv, text);
  }

  if (conv.status === 'reviewing_prompt') {
    // They're providing refinements
    return handlePromptRefinement(chatId, conv, text);
  }

  // Creating new destination flow
  if (conv.status === 'creating_dest_name') {
    return handleNewDestName(chatId, conv, text);
  }
  if (conv.status === 'creating_dest_icon') {
    return handleNewDestIcon(chatId, conv, text);
  }
  if (conv.status === 'creating_dest_description') {
    return handleNewDestDescription(chatId, conv, text);
  }

  // For other statuses, start fresh
  await updateConversation(conv.id, { status: 'cancelled' });
  await sendMessage(chatId, "Let me start fresh with your new message...");
  // Re-process as new message
  const destinations = await getDestinations();
  const newConv = await createConversation(chatId, conv.telegram_user_id, conv.telegram_username, text);
  const classification = await classifyMessage(text, destinations);
  // ... continue with flow (simplified for brevity)
}

// ═══════════════════════════════════════════════════════════════
// NEW DESTINATION CREATION FLOW
// ═══════════════════════════════════════════════════════════════

async function startNewDestinationFlow(chatId, convId) {
  await updateConversation(convId, { status: 'creating_dest_name', answers: {} });
  await sendMessage(chatId,
    `➕ *Create New Destination*\n\n` +
    `What should this destination be called?\n\n` +
    `_(e.g., "VoiceForge", "Personal Journal", "Client Work")_`
  );
}

async function handleNewDestName(chatId, conv, name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const answers = { ...(conv.answers || {}), name, slug };
  await updateConversation(conv.id, { answers, status: 'creating_dest_icon' });

  await sendMessage(chatId,
    `Great! *${name}*\n\n` +
    `Now send me an emoji icon for this destination:\n\n` +
    `_(e.g., 🎙️ 📓 💼 🎨 🔧)_`
  );
}

async function handleNewDestIcon(chatId, conv, icon) {
  // Take first emoji or default
  const emojiMatch = icon.match(/\p{Emoji}/u);
  const finalIcon = emojiMatch ? emojiMatch[0] : '📌';

  const answers = { ...(conv.answers || {}), icon: finalIcon };
  await updateConversation(conv.id, { answers, status: 'creating_dest_description' });

  await sendMessage(chatId,
    `${finalIcon} Nice!\n\n` +
    `Now give a brief description of what goes in this destination:\n\n` +
    `_(This helps the AI classify future messages correctly)_`
  );
}

async function handleNewDestDescription(chatId, conv, description) {
  const answers = conv.answers || {};
  const { name, slug, icon } = answers;

  // Create the new destination in Supabase
  const newDest = await supabaseRequest('POST', 'intake_destinations', {
    name,
    slug,
    icon,
    description,
    target_type: 'notebox',
    notebox_status: slug, // Use slug as the status for NoteBox
    keywords: name.toLowerCase().split(' '),
    template_questions: [],
    prompt_template: `New item for ${name}:\n\nTitle: {title}\nContent: {content}\n\nPlease process this ${name} item.`,
    active: true,
    sort_order: 99
  });

  if (!newDest || !newDest[0]) {
    await sendMessage(chatId, "❌ Failed to create destination. Please try again.");
    await updateConversation(conv.id, { status: 'cancelled' });
    return;
  }

  const destination = newDest[0];

  // Save directly to the new destination
  await saveToNoteBox(chatId, conv.id, destination, {});
}

async function handleDestinationConfirm(chatId, convId, destSlug) {
  const destinations = await getDestinations();
  const destination = destinations.find(d => d.slug === destSlug);

  if (!destination) {
    await sendMessage(chatId, "Destination not found. Please try again.");
    return;
  }

  // Save directly - no confirmation needed
  await saveToNoteBox(chatId, convId, destination, {});
}

async function showContentForReview(chatId, convId, destination, conv) {
  // Use extracted title, or generate from raw message
  let title = conv.extracted_title;
  if (!title || title === 'null') {
    // Generate title from first 50 chars of raw message
    title = (conv.raw_message || '').slice(0, 50);
    if (conv.raw_message && conv.raw_message.length > 50) title += '...';
    if (!title) title = 'Untitled';
  }
  const content = conv.extracted_content || conv.raw_message || '';

  const preview = content.length > 500 ? content.slice(0, 500) + '...' : content;

  await sendMessage(chatId,
    `📝 *Here's what I'll save to ${destination.icon} ${destination.name}:*\n\n` +
    `*${title}*\n\n` +
    `${preview}\n\n` +
    `_Reply with changes, or confirm to save._`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Save it!', callback_data: `confirm_save|${convId}` },
            { text: '❌ Cancel', callback_data: `cancel|${convId}` }
          ]
        ]
      }
    }
  );
}

async function handleContentRefinement(chatId, conv, refinement) {
  // Use AI to refine the content based on user feedback
  const fetch = (await import('node-fetch')).default;

  const prompt = `You are helping refine a note before saving it.

Current title: "${conv.extracted_title}"
Current content: "${conv.extracted_content || conv.raw_message}"

User's refinement request: "${refinement}"

Update the title and content based on the user's feedback. Keep it concise.

Respond with JSON only (no markdown):
{
  "title": "updated title",
  "content": "updated content"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        })
      }
    );

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1] || jsonMatch[0];
    }

    const refined = JSON.parse(jsonStr);

    // Update conversation with refined content
    await updateConversation(conv.id, {
      extracted_title: refined.title || conv.extracted_title,
      extracted_content: refined.content || conv.extracted_content
    });

    // Get destination and show updated content
    const destinations = await getDestinations();
    const destination = destinations.find(d => d.id === conv.detected_destination_id);

    const updatedConv = {
      ...conv,
      extracted_title: refined.title || conv.extracted_title,
      extracted_content: refined.content || conv.extracted_content
    };

    await showContentForReview(chatId, conv.id, destination, updatedConv);
  } catch (err) {
    console.error('Refinement error:', err);
    await sendMessage(chatId, "Sorry, I couldn't process that refinement. Try again or just confirm to save as-is.");
  }
}

async function askNextQuestion(chatId, convId, destination, questionIndex, currentAnswers) {
  const questions = destination.template_questions || [];

  if (questionIndex >= questions.length) {
    // All questions answered - save directly to NoteBox
    return saveToNoteBox(chatId, convId, destination, currentAnswers);
  }

  const question = questions[questionIndex];

  if (question.options) {
    // Multiple choice
    const keyboard = question.options.map(opt => [{
      text: opt,
      callback_data: `ans_${convId}_${question.key}_${opt.slice(0, 20)}`
    }]);

    if (!question.required) {
      keyboard.push([{ text: '⏭️ Skip', callback_data: `skip_${convId}_${question.key}` }]);
    }

    await sendMessage(chatId, `*Question ${questionIndex + 1}/${questions.length}*\n\n${question.question}`, {
      reply_markup: { inline_keyboard: keyboard }
    });
  } else {
    // Free text
    await sendMessage(chatId, `*Question ${questionIndex + 1}/${questions.length}*\n\n${question.question}\n\n_(Just type your answer)_`);
  }

  await updateConversation(convId, {
    current_question_index: questionIndex,
    status: 'asking_questions'
  });
}

async function handleQuestionAnswer(chatId, conv, answerText) {
  const destinations = await getDestinations();
  const destination = destinations.find(d => d.id === conv.detected_destination_id);

  if (!destination) return;

  const questions = destination.template_questions || [];
  const currentQ = questions[conv.current_question_index];

  if (!currentQ) return;

  // Save answer
  const answers = { ...(conv.answers || {}), [currentQ.key]: answerText };
  await updateConversation(conv.id, { answers });

  // Move to next question
  await askNextQuestion(chatId, conv.id, destination, conv.current_question_index + 1, answers);
}

async function saveToNoteBox(chatId, convId, destination, answers) {
  // Get conversation for title/content
  const convs = await supabaseRequest('GET', `intake_conversations?id=eq.${convId}`);
  const conv = convs[0];

  if (!conv) return;

  // Get title with fallback
  let title = conv.extracted_title;
  if (!title || title === 'null') {
    title = (conv.raw_message || '').slice(0, 50);
    if (conv.raw_message && conv.raw_message.length > 50) title += '...';
    if (!title) title = 'Untitled';
  }

  // Build enriched content from answers
  let enrichedContent = conv.extracted_content || conv.raw_message || '';
  if (Object.keys(answers).length > 0) {
    const answersText = Object.entries(answers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    enrichedContent = enrichedContent
      ? `${enrichedContent}\n\n---\n${answersText}`
      : answersText;
  }

  // Save to personal_ideas (NoteBox)
  await supabaseRequest('POST', 'personal_ideas', {
    raw_input: conv.raw_message,
    category: destination.slug || 'brainstorm',
    title: title,
    content: enrichedContent,
    destination_slug: destination.slug,
    status: 'inbox',
    user_id: `tg_${conv.telegram_user_id}`
  });

  await updateConversation(convId, { status: 'done', answers });

  await sendMessage(chatId,
    `✅ *Saved to NoteBox!*\n\n` +
    `📁 *${destination.name}*\n` +
    `📝 "${title}"\n\n` +
    `_Check your Factory → NoteBox to see it._`
  );
}

async function showPromptForReview(chatId, convId, destination, answers) {
  // Get conversation for title/content
  const convs = await supabaseRequest('GET', `intake_conversations?id=eq.${convId}`);
  const conv = convs[0];

  const prompt = generatePrompt(
    destination,
    conv.extracted_title,
    conv.extracted_content,
    answers
  );

  await updateConversation(convId, {
    generated_prompt: prompt,
    answers,
    status: 'reviewing_prompt'
  });

  // Show preview (truncate if too long)
  const displayPrompt = prompt.length > 1500 ? prompt.slice(0, 1500) + '...' : prompt;

  await sendMessage(chatId,
    `*Here's the prompt I'll send to Claude:*\n\n\`\`\`\n${displayPrompt}\n\`\`\`\n\n` +
    `Ready to send?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Send it!', callback_data: `approve_${convId}` },
            { text: '✏️ Refine', callback_data: `refine_${convId}` }
          ],
          [{ text: '❌ Cancel', callback_data: `cancel_${convId}` }]
        ]
      }
    }
  );
}

async function handlePromptRefinement(chatId, conv, refinement) {
  // Get current prompt and append refinement
  const newPrompt = conv.generated_prompt + `\n\nAdditional context from user: ${refinement}`;

  await updateConversation(conv.id, {
    generated_prompt: newPrompt,
    status: 'reviewing_prompt'
  });

  const displayPrompt = newPrompt.length > 1500 ? newPrompt.slice(0, 1500) + '...' : newPrompt;

  await sendMessage(chatId,
    `*Updated prompt:*\n\n\`\`\`\n${displayPrompt}\n\`\`\`\n\n` +
    `Ready now?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Send it!', callback_data: `approve_${conv.id}` },
            { text: '✏️ More refinements', callback_data: `refine_${conv.id}` }
          ],
          [{ text: '❌ Cancel', callback_data: `cancel_${conv.id}` }]
        ]
      }
    }
  );
}

async function handleApprove(chatId, convId) {
  const convs = await supabaseRequest('GET', `intake_conversations?id=eq.${convId}`);
  const conv = convs[0];

  if (!conv) return;

  // Create claude_task
  await supabaseRequest('POST', 'claude_tasks', {
    idea_id: null,
    prompt: conv.generated_prompt,
    target: 'stuartfactory',
    status: 'pending'
  });

  // Also add to personal_ideas for NoteBox tracking
  const destinations = await getDestinations();
  const destination = destinations.find(d => d.id === conv.detected_destination_id);

  if (destination) {
    // Use 'inbox' status for active items, but track destination via destination_slug
    const status = ['inbox', 'pushed', 'artstu'].includes(destination.notebox_status)
      ? destination.notebox_status
      : 'inbox';

    await supabaseRequest('POST', 'personal_ideas', {
      raw_input: conv.raw_message,
      category: 'brainstorm',
      title: conv.extracted_title,
      content: conv.extracted_content,
      destination_slug: destination.slug, // Track which destination this belongs to
      status: status,
      user_id: `tg_${conv.telegram_user_id}` // For Factory NoteBox filtering
    });
  }

  await updateConversation(convId, { status: 'done' });

  await sendMessage(chatId,
    `✅ *Sent to Claude!*\n\n` +
    `Your prompt is in the queue. The daemon on your PC will pick it up and execute it.\n\n` +
    `_Check your terminal or NoteBox to see the result._`
  );
}

// ═══════════════════════════════════════════════════════════════
// CALLBACK QUERY HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  await answerCallback(query.id);

  // Parse callback data (using | delimiter)
  if (data.startsWith('dest|')) {
    // dest|convId|slug
    const [, convId, slug] = data.split('|');
    await handleDestinationConfirm(chatId, convId, slug);
    return;
  }

  if (data.startsWith('newdest|')) {
    // newdest|convId
    const convId = data.split('|')[1];
    await startNewDestinationFlow(chatId, convId);
    return;
  }

  if (data.startsWith('confirm_save|')) {
    // confirm_save|convId
    const convId = data.split('|')[1];
    const convs = await supabaseRequest('GET', `intake_conversations?id=eq.${convId}`);
    const conv = convs[0];
    if (!conv) return;

    const destinations = await getDestinations();
    const destination = destinations.find(d => d.id === conv.detected_destination_id);
    if (!destination) return;

    await saveToNoteBox(chatId, convId, destination, {});
    return;
  }

  if (data.startsWith('ans_')) {
    // ans_convId_key_value
    const parts = data.split('_');
    const convId = parts[1];
    const key = parts[2];
    const value = parts.slice(3).join('_');

    const convs = await supabaseRequest('GET', `intake_conversations?id=eq.${convId}`);
    const conv = convs[0];
    if (!conv) return;

    const destinations = await getDestinations();
    const destination = destinations.find(d => d.id === conv.detected_destination_id);
    if (!destination) return;

    const answers = { ...(conv.answers || {}), [key]: value };
    await updateConversation(convId, { answers });

    await askNextQuestion(chatId, convId, destination, conv.current_question_index + 1, answers);
    return;
  }

  if (data.startsWith('skip_')) {
    // skip_convId_key
    const [, convId, key] = data.split('_');

    const convs = await supabaseRequest('GET', `intake_conversations?id=eq.${convId}`);
    const conv = convs[0];
    if (!conv) return;

    const destinations = await getDestinations();
    const destination = destinations.find(d => d.id === conv.detected_destination_id);
    if (!destination) return;

    await askNextQuestion(chatId, convId, destination, conv.current_question_index + 1, conv.answers || {});
    return;
  }

  if (data.startsWith('approve_')) {
    const convId = data.replace('approve_', '');
    await handleApprove(chatId, convId);
    return;
  }

  if (data.startsWith('refine_')) {
    const convId = data.replace('refine_', '');
    await updateConversation(convId, { status: 'reviewing_prompt' });
    await sendMessage(chatId, "What would you like to add or change? Just type it out.");
    return;
  }

  if (data.startsWith('cancel_') || data.startsWith('cancel|')) {
    const convId = data.includes('|') ? data.split('|')[1] : data.replace('cancel_', '');
    await updateConversation(convId, { status: 'cancelled' });
    await sendMessage(chatId, "❌ Cancelled. Send me something new whenever you're ready!");
    return;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('StuartFactoryBot is running!');
  }

  try {
    const update = req.body;

    // Handle messages
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const username = update.message.from.username || 'user';
      const text = update.message.text;

      // Check authorization
      if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(String(userId))) {
        await sendMessage(chatId, "Sorry, this bot is private. 🔒");
        return res.status(200).send('OK');
      }

      // Handle /start
      if (text === '/start') {
        await sendMessage(chatId,
          `📝 *Welcome to NoteBox Bot!*\n\n` +
          `Send me any idea, note, or thought and I'll:\n` +
          `1. Ask where it should go (or create a new section)\n` +
          `2. Show you a summary to confirm or refine\n` +
          `3. Save it to your NoteBox\n\n` +
          `Your notes appear in Factory → NoteBox, organized by destination.\n\n` +
          `_Try it! Just send me anything._`
        );
        return res.status(200).send('OK');
      }

      // Handle /cancel
      if (text === '/cancel') {
        const conv = await getConversation(chatId);
        if (conv) {
          await updateConversation(conv.id, { status: 'cancelled' });
        }
        await sendMessage(chatId, "✅ Cancelled. Ready for your next idea!");
        return res.status(200).send('OK');
      }

      // Handle /destinations - list all destinations
      if (text === '/destinations') {
        const destinations = await getDestinations();
        const list = destinations.map(d => `${d.icon} *${d.name}* (${d.slug})\n   ${d.description}`).join('\n\n');
        await sendMessage(chatId, `*Available Destinations:*\n\n${list}`);
        return res.status(200).send('OK');
      }

      // Process new message
      await handleNewMessage(chatId, userId, username, text);
      return res.status(200).send('OK');
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return res.status(200).send('OK');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to Telegram
  }
};
