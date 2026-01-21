// Supabase Edge Function: factory-refine
// Refine proposal text using AI to make it clearer and more structured

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// SECURITY: Restrict CORS to only allow requests from getsuite.app
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://getsuite.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
- Keep it under 200 words
- Use simple, direct language
- If it's a feature request, structure as: What + Why + Benefit
- If it's a bug report, structure as: Issue + Steps/Context + Expected behavior
- If it's an app idea, structure as: App concept + Target users + Key features
- Don't add features or ideas the user didn't mention
- Keep the tone professional but friendly

Section: ${section || 'general'}
Original text: ${text}

Return ONLY the refined text, no explanations or markdown formatting.`

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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
