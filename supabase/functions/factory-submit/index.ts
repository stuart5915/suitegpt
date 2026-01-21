// Supabase Edge Function: factory-submit
// Submit proposals to getSuite Factory governance system

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// SECURITY: Restrict CORS to only allow requests from getsuite.app
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://getsuite.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valid categories
const CATEGORIES = ['feature', 'bug', 'app_idea', 'improvement', 'docs', 'integration', 'tokenomics']

// Verify Telegram auth data
function verifyTelegramAuth(authData: any): boolean {
  if (!authData || !authData.hash) return false

  const { hash, ...data } = authData
  const checkString = Object.keys(data)
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(TELEGRAM_BOT_TOKEN)
    .digest()

  const hmac = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex')

  return hmac === hash
}

// Calculate submission limit based on reputation
function getSubmissionLimit(reputation: number): number {
  const baseLimit = 5
  const repBonus = Math.min(Math.floor(reputation / 100), 10)
  return baseLimit + repBonus
}

// Generate proposal metadata using Gemini Flash 2.0
async function generateProposalMetadata(description: string, section: string): Promise<{
  title: string
  category: string
  app_target: string | null
}> {
  const prompt = `Analyze this proposal and extract:
- title: concise 3-8 word title
- category: one of [feature, bug, app_idea, improvement, docs, integration, tokenomics]
- app_target: if mentioning a specific app (FoodVitals, Cheshbon, OpticRep, TrueForm, REMcast), return lowercase slug (foodvitals, cheshbon, opticrep, trueform, remcast), else null

Section: ${section}
Description: ${description}

Return JSON only: {"title": "...", "category": "...", "app_target": null}`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('No response from Gemini')

    const parsed = JSON.parse(text)
    return {
      title: parsed.title || description.slice(0, 50) + (description.length > 50 ? '...' : ''),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'feature',
      app_target: parsed.app_target || null
    }
  } catch (error) {
    console.error('Gemini AI error:', error)
    // Fallback: use defaults
    return {
      title: description.slice(0, 50) + (description.length > 50 ? '...' : ''),
      category: 'feature',
      app_target: null
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    let { title, content, category, app_target, section, telegram_auth, wallet_address } = body

    // Validate: need content at minimum
    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // If title/category not provided, use AI to generate them
    if (!title || !category) {
      console.log('Generating metadata with Gemini AI...')
      const metadata = await generateProposalMetadata(content, section || 'general')
      title = title || metadata.title
      category = category || metadata.category
      app_target = app_target || metadata.app_target
      console.log('AI generated:', { title, category, app_target })
    }

    if (!CATEGORIES.includes(category)) {
      category = 'feature' // Fallback if AI gave invalid category
    }

    // Must have either Telegram auth or wallet
    if (!telegram_auth && !wallet_address) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find or create user
    let user = null

    if (telegram_auth) {
      // SECURITY: Verify Telegram auth data is genuine
      if (!verifyTelegramAuth(telegram_auth)) {
        console.error('Telegram auth verification failed')
        return new Response(JSON.stringify({ error: 'Invalid Telegram authentication' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        })
      }

      const telegramId = telegram_auth.id?.toString()

      if (!telegramId) {
        return new Response(JSON.stringify({ error: 'Invalid Telegram auth' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        })
      }

      // Find existing user by Telegram ID
      const { data: existingUser } = await supabase
        .from('factory_users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single()

      if (existingUser) {
        user = existingUser
      } else {
        // Create new user
        const displayName = telegram_auth.username || telegram_auth.first_name || `User${telegramId.slice(-4)}`
        const { data: newUser, error: createError } = await supabase
          .from('factory_users')
          .insert({
            telegram_id: telegramId,
            display_name: displayName,
            reputation: 0
          })
          .select()
          .single()

        if (createError) {
          console.error('Failed to create user:', createError)
          return new Response(JSON.stringify({ error: 'Failed to create user' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }
        user = newUser
      }
    } else if (wallet_address) {
      // Find existing user by wallet
      const walletLower = wallet_address.toLowerCase()
      const { data: existingUser } = await supabase
        .from('factory_users')
        .select('*')
        .eq('wallet_address', walletLower)
        .single()

      if (existingUser) {
        user = existingUser
      } else {
        // Create new user with wallet
        const displayName = `${walletLower.slice(0, 6)}...${walletLower.slice(-4)}`
        const { data: newUser, error: createError } = await supabase
          .from('factory_users')
          .insert({
            wallet_address: walletLower,
            display_name: displayName,
            reputation: 0
          })
          .select()
          .single()

        if (createError) {
          console.error('Failed to create user:', createError)
          return new Response(JSON.stringify({ error: 'Failed to create user' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }
        user = newUser
      }
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'Failed to authenticate user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    // Check submission limit
    const limit = getSubmissionLimit(user.reputation)

    // Count active submissions (submitted or open_voting)
    const { count: activeCount } = await supabase
      .from('factory_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .in('status', ['submitted', 'open_voting'])

    if ((activeCount || 0) >= limit) {
      return new Response(JSON.stringify({
        error: `Submission limit reached (${limit}). Wait for proposals to be processed or earn more reputation.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429
      })
    }

    // Create the proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('factory_proposals')
      .insert({
        author_id: user.id,
        title: title.trim(),
        content: content?.trim() || null,
        category,
        section: section || 'business',
        app_target: app_target || null,
        status: 'submitted'
      })
      .select()
      .single()

    if (proposalError) {
      console.error('Failed to create proposal:', proposalError)
      return new Response(JSON.stringify({ error: 'Failed to create proposal' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    // Update user's active submission count
    await supabase
      .from('factory_users')
      .update({
        active_submissions: (activeCount || 0) + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', user.id)

    return new Response(JSON.stringify({
      success: true,
      proposal,
      user: {
        id: user.id,
        display_name: user.display_name,
        reputation: user.reputation
      }
    }), {
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
