// Supabase Edge Function: factory-comment
// Post comments on getSuite Factory proposals

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!

// SECURITY: Verify Telegram auth data is genuine
function verifyTelegramAuth(authData: any): boolean {
  if (!authData || !authData.hash || !TELEGRAM_BOT_TOKEN) return false

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
    const body = await req.json()
    const { proposal_id, content, telegram_auth, wallet_address } = body

    // Validate required fields
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: 'Proposal ID required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Comment content required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Limit comment length
    if (content.length > 1000) {
      return new Response(JSON.stringify({ error: 'Comment too long (max 1000 characters)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
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
          return new Response(JSON.stringify({ error: 'Failed to create user' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }
        user = newUser
      }
    } else if (wallet_address) {
      const walletLower = wallet_address.toLowerCase()
      const { data: existingUser } = await supabase
        .from('factory_users')
        .select('*')
        .eq('wallet_address', walletLower)
        .single()

      if (existingUser) {
        user = existingUser
      } else {
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

    // Check proposal exists
    const { data: proposal, error: proposalError } = await supabase
      .from('factory_proposals')
      .select('id, title')
      .eq('id', proposal_id)
      .single()

    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: 'Proposal not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      })
    }

    // Insert comment
    const { data: comment, error: commentError } = await supabase
      .from('factory_comments')
      .insert({
        proposal_id,
        user_id: user.id,
        content: content.trim()
      })
      .select(`
        id,
        content,
        created_at,
        user_id
      `)
      .single()

    if (commentError) {
      console.error('Comment insert error:', commentError)
      return new Response(JSON.stringify({ error: 'Failed to post comment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    // Update user's last_active_at
    await supabase
      .from('factory_users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id)

    return new Response(JSON.stringify({
      success: true,
      comment: {
        ...comment,
        user: {
          id: user.id,
          display_name: user.display_name
        }
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
