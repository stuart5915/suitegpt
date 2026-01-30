// Supabase Edge Function: suitegpt-chat
// AI-powered chat that routes users to SUITE apps

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// CORS headers - Allow requests from getsuite.app
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://getsuite.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SUITE Apps Catalog with keywords for routing
const SUITE_APPS = [
  {
    slug: 'foodvitals',
    name: 'FoodVitals',
    description: 'Weekly meal tracking + AI nutrition insights',
    capabilities: 'Track meals by taking photos, get weekly nutrition reports, AI-powered dietary analysis, weight management support',
    keywords: ['nutrition', 'diet', 'calories', 'food', 'meals', 'weight', 'eating', 'healthy', 'track meals', 'lose weight', 'gain weight', 'macros', 'protein']
  },
  {
    slug: 'trueform',
    name: 'TrueForm AI',
    description: 'AI physiotherapy and exercise guidance',
    capabilities: 'Guided stretching routines, posture correction, pain relief exercises, movement analysis, desk worker wellness',
    keywords: ['back pain', 'posture', 'stretching', 'physical therapy', 'exercise', 'mobility', 'pain', 'sitting', 'desk', 'injury', 'neck', 'shoulder', 'physiotherapy']
  },
  {
    slug: 'opticrep',
    name: 'OpticRep',
    description: 'AI workout trainer with form analysis',
    capabilities: 'Real-time form feedback during exercises, personalized workout plans, rep counting, strength training guidance',
    keywords: ['workout', 'gym', 'fitness', 'exercise', 'training', 'muscle', 'strength', 'form', 'reps', 'sets', 'lifting']
  },
  {
    slug: 'cheshbon',
    name: 'Cheshbon',
    description: 'Financial reflection and tracking app',
    capabilities: 'Track spending patterns, financial journaling, budget insights, money mindfulness',
    keywords: ['money', 'finance', 'budget', 'spending', 'savings', 'track spending', 'financial', 'expenses', 'income']
  },
  {
    slug: 'remcast',
    name: 'RemCast',
    description: 'Smart reminder and notification system',
    capabilities: 'Custom reminders, habit tracking, morning/evening routines, recurring notifications',
    keywords: ['reminder', 'routine', 'morning', 'habits', 'schedule', 'notification', 'daily', 'evening', 'wake up', 'bedtime']
  },
  {
    slug: 'defi-knowledge',
    name: 'DeFi Knowledge',
    description: 'Learn DeFi concepts and strategies',
    capabilities: 'Interactive DeFi tutorials, yield farming guides, risk assessment tools, crypto education',
    keywords: ['defi', 'crypto', 'blockchain', 'learn', 'education', 'yield', 'trading', 'ethereum', 'staking', 'liquidity']
  }
]

// Build system prompt with app catalog
const SYSTEM_PROMPT = `You are SuiteGPT, a helpful AI assistant. You can answer questions on any topic, have normal conversations, and help users with whatever they need.

You are also knowledgeable about the SUITE ecosystem, which has these apps available:
${SUITE_APPS.map(app => `
- ${app.name} (slug: ${app.slug}): ${app.description}
`).join('\n')}

Guidelines:
1. Be a normal, helpful AI assistant — answer questions, have conversations, help with tasks
2. Only recommend SUITE apps when genuinely relevant to what the user is asking about
3. Be conversational and concise
4. Never force app recommendations — if the user says "hey" or asks a general question, just respond naturally
5. You can have follow-up conversations - remember context

If you recommend a SUITE app, include the slug at the end of your response on a new line:
[APP_RECOMMENDATION: slug]

If not recommending any app, don't include this line.`

// Parse app recommendation from response
function parseAppRecommendation(response: string): { cleanResponse: string, recommendedApp: string | null } {
  const match = response.match(/\[APP_RECOMMENDATION:\s*(\w+)\]/i)
  if (match) {
    return {
      cleanResponse: response.replace(/\n?\[APP_RECOMMENDATION:\s*\w+\]/i, '').trim(),
      recommendedApp: match[1]
    }
  }
  return { cleanResponse: response, recommendedApp: null }
}

// Call Gemini API
async function generateResponse(message: string, history: Array<{role: string, content: string}>): Promise<{response: string, recommendedApp: string | null}> {
  // Build conversation for Gemini
  const contents = [
    {
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT + '\n\nNow respond to the user.' }]
    },
    {
      role: 'model',
      parts: [{ text: "I understand. I'm SuiteGPT, a helpful AI assistant. I'll have natural conversations, answer questions, and mention SUITE apps only when relevant." }]
    }
  ]

  // Add conversation history
  for (const msg of history.slice(-8)) { // Keep last 8 messages for context
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })
  }

  // Add current message
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  })

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        topP: 0.9
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

  return parseAppRecommendation(content)
}

// Local fallback when Gemini is unavailable
function getLocalResponse(message: string): { response: string, recommendedApp: string | null } {
  const lowerMessage = message.toLowerCase()

  // Find matching app by keywords
  let bestMatch: typeof SUITE_APPS[0] | null = null
  let bestScore = 0

  for (const app of SUITE_APPS) {
    const matchScore = app.keywords.filter(kw => lowerMessage.includes(kw)).length
    if (matchScore > bestScore) {
      bestScore = matchScore
      bestMatch = app
    }
  }

  if (bestMatch && bestScore > 0) {
    return {
      response: `I can help with that!\n\n${bestMatch.name} is designed exactly for this. ${bestMatch.description}. ${bestMatch.capabilities.split(', ')[0]}.`,
      recommendedApp: bestMatch.slug
    }
  }

  return {
    response: "I'm here to help! What would you like to know or talk about?",
    recommendedApp: null
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, history = [] } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    let result: { response: string, recommendedApp: string | null }

    try {
      // Try Gemini first
      result = await generateResponse(message, history)
    } catch (aiError) {
      console.error('Gemini failed, using local fallback:', aiError)
      // Fall back to local keyword matching
      result = getLocalResponse(message)
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
