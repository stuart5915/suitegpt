// Supabase Edge Function: factory-admin
// Admin operations (delete, status update) for founders only

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    const { action, proposal_id, telegram_id, wallet_address, new_status, reject_reason } = await req.json()

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Must have some form of auth
    if (!telegram_id && !wallet_address) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find user and verify they're a founder
    let user = null
    if (telegram_id) {
      const { data } = await supabase
        .from('factory_users')
        .select('*')
        .eq('telegram_id', telegram_id.toString())
        .single()
      user = data
    } else if (wallet_address) {
      const { data } = await supabase
        .from('factory_users')
        .select('*')
        .eq('wallet_address', wallet_address.toLowerCase())
        .single()
      user = data
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      })
    }

    if (!user.is_founder) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      })
    }

    // Handle actions
    if (action === 'delete' && proposal_id) {
      const { error } = await supabase
        .from('factory_proposals')
        .delete()
        .eq('id', proposal_id)

      if (error) {
        console.error('Delete error:', error)
        return new Response(JSON.stringify({ error: 'Failed to delete' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'update_status' && proposal_id && new_status) {
      const updateData: any = { status: new_status }
      if (reject_reason) {
        updateData.reject_reason = reject_reason
      }

      const { error } = await supabase
        .from('factory_proposals')
        .update(updateData)
        .eq('id', proposal_id)

      if (error) {
        console.error('Update error:', error)
        return new Response(JSON.stringify({ error: 'Failed to update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
