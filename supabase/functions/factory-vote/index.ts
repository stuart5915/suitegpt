// Supabase Edge Function: factory-vote
// Cast votes on getSuite Factory proposals with quadratic voting

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Calculate quadratic voting cost: cost(n) = n * (n-1) / 2
// 1st vote = free, 2nd costs 1, 3rd costs 3 more (4 total), etc.
function calculateVoteCost(voteCount: number): number {
  if (voteCount <= 1) return 0
  return (voteCount * (voteCount - 1)) / 2
}

// Calculate incremental cost from current votes to new total
function calculateIncrementalCost(currentVotes: number, newTotalVotes: number): number {
  return calculateVoteCost(newTotalVotes) - calculateVoteCost(currentVotes)
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { proposal_id, direction, vote_type, vote_power, telegram_auth, wallet_address } = body

    // Validate required fields
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: 'Proposal ID required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Accept vote_type ('for'/'against') or direction (1/-1)
    let voteDirection: number
    if (vote_type) {
      voteDirection = vote_type === 'for' ? 1 : -1
    } else if (direction === 1 || direction === -1) {
      voteDirection = direction
    } else {
      return new Response(JSON.stringify({ error: 'Vote type must be "for" or "against"' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Vote power defaults to 1 (the free vote)
    const requestedPower = Math.max(1, Math.floor(vote_power || 1))

    // Must have either Telegram auth or wallet
    if (!telegram_auth && !wallet_address) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find user
    let user = null

    if (telegram_auth) {
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
        // Create new user for voting
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

    // Check proposal exists and is open for voting
    const { data: proposal, error: proposalError } = await supabase
      .from('factory_proposals')
      .select('*')
      .eq('id', proposal_id)
      .single()

    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: 'Proposal not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      })
    }

    // Can only vote on submitted or open_voting proposals
    if (!['submitted', 'open_voting'].includes(proposal.status)) {
      return new Response(JSON.stringify({ error: 'Proposal is not open for voting' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Check if voting has ended
    if (proposal.voting_ends_at && new Date(proposal.voting_ends_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Voting period has ended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Check existing vote
    const { data: existingVote } = await supabase
      .from('factory_votes')
      .select('*')
      .eq('proposal_id', proposal_id)
      .eq('user_id', user.id)
      .single()

    let currentVotePower = 0
    let currentRepSpent = 0

    if (existingVote) {
      // Can't change vote direction
      if (existingVote.vote_direction !== voteDirection) {
        return new Response(JSON.stringify({ error: 'Cannot change vote direction. You already voted ' + (existingVote.vote_direction === 1 ? 'FOR' : 'AGAINST') }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }
      currentVotePower = existingVote.vote_power
      currentRepSpent = existingVote.rep_spent
    }

    // Calculate cost for additional votes
    const newTotalPower = Math.max(currentVotePower, requestedPower)
    const additionalCost = calculateIncrementalCost(currentVotePower, newTotalPower)

    // Check if user has enough rep
    if (additionalCost > user.reputation) {
      const maxAffordable = Math.floor(Math.sqrt(2 * (user.reputation + currentRepSpent)) + 0.5)
      return new Response(JSON.stringify({
        error: `Not enough reputation. You need ${additionalCost} rep for ${newTotalPower} votes. You have ${user.reputation} rep.`,
        max_affordable_votes: maxAffordable,
        current_votes: currentVotePower
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Deduct rep from user
    if (additionalCost > 0) {
      const { error: repError } = await supabase
        .from('factory_users')
        .update({
          reputation: user.reputation - additionalCost,
          last_active_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (repError) {
        return new Response(JSON.stringify({ error: 'Failed to deduct reputation' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }

      // Record rep history
      await supabase
        .from('factory_rep_history')
        .insert({
          user_id: user.id,
          amount: -additionalCost,
          reason: 'vote_cast',
          proposal_id: proposal_id
        })
    }

    // Insert or update vote
    const newRepSpent = currentRepSpent + additionalCost

    if (existingVote) {
      // Update existing vote
      const { error: voteError } = await supabase
        .from('factory_votes')
        .update({
          vote_power: newTotalPower,
          rep_spent: newRepSpent
        })
        .eq('id', existingVote.id)

      if (voteError) {
        return new Response(JSON.stringify({ error: 'Failed to update vote' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }
    } else {
      // Insert new vote
      const { error: voteError } = await supabase
        .from('factory_votes')
        .insert({
          proposal_id,
          user_id: user.id,
          vote_direction: voteDirection,
          vote_power: newTotalPower,
          rep_spent: newRepSpent
        })

      if (voteError) {
        return new Response(JSON.stringify({ error: 'Failed to record vote' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }

      // Award +1 rep for first vote (participation reward)
      await supabase
        .from('factory_users')
        .update({
          reputation: user.reputation - additionalCost + 1
        })
        .eq('id', user.id)

      await supabase
        .from('factory_rep_history')
        .insert({
          user_id: user.id,
          amount: 1,
          reason: 'vote_cast',
          proposal_id: proposal_id
        })
    }

    // If this is first vote on a submitted proposal, open voting
    if (proposal.status === 'submitted') {
      const votingEnds = new Date()
      votingEnds.setDate(votingEnds.getDate() + 7) // 7 day voting period

      await supabase
        .from('factory_proposals')
        .update({
          status: 'open_voting',
          voting_ends_at: votingEnds.toISOString()
        })
        .eq('id', proposal_id)
    }

    // Get updated proposal with vote counts
    const { data: updatedProposal } = await supabase
      .from('factory_proposals')
      .select('*')
      .eq('id', proposal_id)
      .single()

    return new Response(JSON.stringify({
      success: true,
      vote: {
        direction: voteDirection,
        vote_type: voteDirection === 1 ? 'for' : 'against',
        vote_power: newTotalPower,
        rep_spent: newRepSpent,
        additional_cost: additionalCost
      },
      proposal: updatedProposal,
      user: {
        id: user.id,
        reputation: user.reputation - additionalCost + (existingVote ? 0 : 1)
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
