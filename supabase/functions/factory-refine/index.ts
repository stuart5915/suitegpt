// Supabase Edge Function: factory-refine
// Refine proposal text using AI to make it clearer and more structured

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// SECURITY: Restrict CORS to only allow requests from getsuite.app
const ALLOWED_ORIGINS = ['https://getsuite.app', 'https://www.getsuite.app']

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, section } = await req.json()

    if (!text || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Please write at least a few words to refine' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const prompt = `You are helping refine a governance proposal for SUITE, an AI-powered app ecosystem.

Take this rough idea and rewrite it to be clear, concise, and well-structured. Keep the original intent but make it easier to understand.

Rules:
- Keep it under 150 words
- Use simple, direct language
- NO markdown, NO bold, NO headers, NO title line - just the proposal content
- Start directly with the proposal, no preamble
- Separate each section with a blank line for readability
- If it's a feature request, use 3 short paragraphs: What it is, why it's needed, and the benefit
- If it's a bug report, use 3 short paragraphs: The issue, context, and expected behavior
- If it's an app idea, use 3 short paragraphs: App concept, target users, and key features
- Don't add features or ideas the user didn't mention
- Keep the tone professional but friendly

Original text: ${text}

Return plain text with paragraph breaks. Start directly with the content, no title.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      }
    )

    if (!response.ok) {
      console.error('Gemini API error:', response.status)
      return new Response(JSON.stringify({ error: 'AI service temporarily unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503
      })
    }

    const data = await response.json()
    const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!refinedText) {
      return new Response(JSON.stringify({ error: 'Failed to refine text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    return new Response(JSON.stringify({ refined: refinedText.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
