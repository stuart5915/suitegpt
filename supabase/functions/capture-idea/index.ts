// Supabase Edge Function: capture-idea
// Receives Telegram webhook, uses AI to categorize, stores in personal_ideas table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// SECURITY: Restrict CORS to only allow requests from getsuite.app
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://getsuite.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Category definitions
const CATEGORIES = [
  'action_item',    // Contact someone, do something specific
  'suite_feature',  // Features for existing SUITE apps
  'suite_business', // Bigger SUITE ecosystem/business ideas
  'app_idea',       // New app concepts
  'article',        // artstu.ca blog post ideas
  'personal',       // Life reminders, tasks
  'brainstorm',     // Ideas needing more thought
  'question'        // Things to research
]

// AI prompt for categorization
const SYSTEM_PROMPT = `You are Stuart's personal idea capture assistant.

Context about Stuart's projects:
- SUITE: DeFi app ecosystem with apps like FoodVitals (nutrition tracking), Cheshbon (reflection journal), OpticRep (workout trainer), TrueForm (movement analysis), REMcast (dream journal)
- artstu.ca: Personal blog about faith, technology, philosophy
- General entrepreneurship and consulting interests

Given user input, extract ALL distinct ideas/items. Each input may contain multiple ideas.

For each idea, return:
- category: one of [action_item, suite_feature, suite_business, app_idea, article, personal, brainstorm, question]
- title: concise 3-8 word title
- content: brief elaboration if needed (can be empty string)

Return a JSON array of items. Example:
[
  {"category": "suite_feature", "title": "Add dark mode to FoodVitals", "content": "User requested dark theme for better night usage"},
  {"category": "question", "title": "Research DeFi treasury protocols", "content": ""}
]

ONLY return valid JSON array. No other text.`

// Ideas web app URL - opens AppFactory with Ideas tab
const IDEAS_WEB_APP_URL = 'https://getsuite.app/appfactory.html?tab=ideas';

// Send message to Telegram with optional inline keyboard
async function sendTelegramMessage(chatId: number, text: string, showViewButton = false) {
  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  if (showViewButton) {
    payload.reply_markup = {
      inline_keyboard: [[
        {
          text: '📋 View Ideas',
          web_app: { url: IDEAS_WEB_APP_URL }
        }
      ]]
    };
  }

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

// Categorize text using Gemini
async function categorizeWithAI(text: string): Promise<Array<{category: string, title: string, content: string}>> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${SYSTEM_PROMPT}\n\nInput: "${text}"`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', errorText)
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content) {
    console.error('No content in Gemini response:', data)
    throw new Error('No content in AI response')
  }

  // Parse JSON from response - Gemini might wrap in markdown code blocks
  try {
    let jsonStr = content.trim()
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const items = JSON.parse(jsonStr)
    // Validate categories
    return items.filter((item: any) =>
      CATEGORIES.includes(item.category) &&
      typeof item.title === 'string' &&
      item.title.length > 0
    )
  } catch (e) {
    console.error('Failed to parse AI response:', content)
    throw new Error('Failed to parse AI response')
  }
}

// Handle optional /commands for direct routing
function parseCommand(text: string): { command: string | null, content: string } {
  const commandMap: { [key: string]: string } = {
    '/app': 'app_idea',
    '/suite': 'suite_feature',
    '/article': 'article',
    '/life': 'personal',
    '/action': 'action_item',
    '/question': 'question',
    '/brainstorm': 'brainstorm',
    '/business': 'suite_business'
  }

  for (const [cmd, category] of Object.entries(commandMap)) {
    if (text.startsWith(cmd)) {
      return {
        command: category,
        content: text.slice(cmd.length).trim()
      }
    }
  }

  return { command: null, content: text }
}

// Category emoji mapping
const CATEGORY_EMOJI: { [key: string]: string } = {
  'action_item': '✅',
  'suite_feature': '⚡',
  'suite_business': '💰',
  'app_idea': '💡',
  'article': '📝',
  'personal': '🏠',
  'brainstorm': '💭',
  'question': '❓'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Telegram webhook format
    const message = body.message
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const chatId = message.chat.id
    const text = message.text.trim()

    // Skip empty messages
    if (!text || text === '/start') {
      await sendTelegramMessage(chatId, 'Send me your ideas and I\'ll capture them!')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse command if present
    const { command, content } = parseCommand(text)

    let items: Array<{category: string, title: string, content: string}> = []

    if (command && content) {
      // Direct categorization from command
      items = [{
        category: command,
        title: content.length > 50 ? content.slice(0, 47) + '...' : content,
        content: content.length > 50 ? content : ''
      }]
    } else if (content) {
      // Use AI to categorize
      try {
        items = await categorizeWithAI(content)
      } catch (e) {
        console.error('AI categorization failed:', e)
        // Fallback: store as brainstorm
        items = [{
          category: 'brainstorm',
          title: content.length > 50 ? content.slice(0, 47) + '...' : content,
          content: content.length > 50 ? content : ''
        }]
      }
    }

    if (items.length === 0) {
      await sendTelegramMessage(chatId, 'Could not extract any ideas from your message. Try again?')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Store in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const insertData = items.map(item => ({
      raw_input: text,
      category: item.category,
      title: item.title,
      content: item.content || null,
      status: 'inbox'
    }))

    const { error } = await supabase
      .from('personal_ideas')
      .insert(insertData)

    if (error) {
      console.error('Supabase insert error:', error)
      await sendTelegramMessage(chatId, 'Failed to save ideas. Please try again.')
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    // Send confirmation with View Ideas button
    const confirmationLines = items.map(item =>
      `${CATEGORY_EMOJI[item.category] || '📌'} <b>${item.title}</b>`
    )
    const confirmationMessage = items.length === 1
      ? `✓ Captured:\n${confirmationLines[0]}`
      : `✓ Captured ${items.length} items:\n${confirmationLines.join('\n')}`

    await sendTelegramMessage(chatId, confirmationMessage, true)

    return new Response(JSON.stringify({ ok: true, captured: items.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
