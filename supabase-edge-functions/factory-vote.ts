// Supabase Edge Function: factory-vote
// Deploy to Supabase: supabase functions deploy factory-vote

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

// SECURITY: Verify Telegram auth data is genuine
function verifyTelegramAuth(authData: any): boolean {
  if (!authData || !authData.hash || !TELEGRAM_BOT_TOKEN) return false;

  const { hash, ...data } = authData;
  const checkString = Object.keys(data)
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(TELEGRAM_BOT_TOKEN)
    .digest();

  const hmac = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return hmac === hash;
}

// SECURITY: Restrict CORS to only allow requests from getsuite.app
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://getsuite.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Quadratic vote cost: 1st free, 2nd=1, 3rd=3, 4th=6, etc.
function getVoteCost(voteNumber: number): number {
  if (voteNumber <= 1) return 0;
  return Math.floor(voteNumber * (voteNumber - 1) / 2);
}

// Get user's current vote count on a proposal
async function getUserVoteCount(supabase: any, userId: string, proposalId: string): Promise<number> {
  const { data, error } = await supabase
    .from('factory_votes')
    .select('vote_power')
    .eq('user_id', userId)
    .eq('proposal_id', proposalId);

  if (error || !data) return 0;
  return data.reduce((sum: number, v: any) => sum + (v.vote_power || 1), 0);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { proposal_id, direction, vote_power = 1, wallet_address, telegram_auth } = body;

    if (!proposal_id) {
      return new Response(
        JSON.stringify({ error: 'proposal_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!direction || !['for', 'against', 'remove'].includes(direction)) {
      return new Response(
        JSON.stringify({ error: 'direction must be "for", "against", or "remove"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== AUTHENTICATE USER =====
    let user = null;

    if (wallet_address) {
      // Find or create user by wallet
      const { data: existing } = await supabase
        .from('factory_users')
        .select('*')
        .eq('wallet_address', wallet_address.toLowerCase())
        .single();

      if (existing) {
        user = existing;
      } else {
        // Create new user
        const { data: newUser, error: createErr } = await supabase
          .from('factory_users')
          .insert({
            wallet_address: wallet_address.toLowerCase(),
            display_name: wallet_address.slice(0, 6) + '...' + wallet_address.slice(-4),
            reputation: 10 // Starting REP
          })
          .select()
          .single();

        if (createErr) {
          return new Response(
            JSON.stringify({ error: 'Failed to create user', details: createErr }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        user = newUser;
      }
    } else if (telegram_auth?.id) {
      // SECURITY: Verify Telegram auth data is genuine
      if (!verifyTelegramAuth(telegram_auth)) {
        return new Response(
          JSON.stringify({ error: 'Invalid Telegram authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find or create user by Telegram ID
      const tgId = telegram_auth.id.toString();
      const { data: existing } = await supabase
        .from('factory_users')
        .select('*')
        .eq('telegram_id', tgId)
        .single();

      if (existing) {
        user = existing;
      } else {
        // Create new user
        const { data: newUser, error: createErr } = await supabase
          .from('factory_users')
          .insert({
            telegram_id: tgId,
            display_name: telegram_auth.username || telegram_auth.first_name || `User ${tgId.slice(-4)}`,
            reputation: 10 // Starting REP
          })
          .select()
          .single();

        if (createErr) {
          return new Response(
            JSON.stringify({ error: 'Failed to create user', details: createErr }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        user = newUser;
      }
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Provide wallet_address or telegram_auth.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET PROPOSAL =====
    const { data: proposal, error: propErr } = await supabase
      .from('factory_proposals')
      .select('*')
      .eq('id', proposal_id)
      .single();

    if (propErr || !proposal) {
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's current vote count on this proposal
    const currentVoteCount = await getUserVoteCount(supabase, user.id, proposal_id);

    // ===== HANDLE VOTE REMOVAL =====
    if (direction === 'remove') {
      if (currentVoteCount <= 0) {
        return new Response(
          JSON.stringify({ error: 'No votes to remove' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the most recent vote to remove
      const { data: existingVotes, error: voteErr } = await supabase
        .from('factory_votes')
        .select('*')
        .eq('proposal_id', proposal_id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (voteErr || !existingVotes || existingVotes.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No votes found to remove' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const voteToRemove = existingVotes[0];
      const repSpentOnThisVote = voteToRemove.rep_spent || 0;

      // Delete the vote
      const { error: deleteErr } = await supabase
        .from('factory_votes')
        .delete()
        .eq('id', voteToRemove.id);

      if (deleteErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to remove vote', details: deleteErr }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Decrement proposal vote count
      const voteDir = voteToRemove.vote_direction || 1;
      const updateField = voteDir === 1 ? 'votes_for' : 'votes_against';

      await supabase
        .from('factory_proposals')
        .update({
          [updateField]: Math.max(0, (proposal[updateField] || 0) - (voteToRemove.vote_power || 1)),
          total_rep_voted: Math.max(0, (proposal.total_rep_voted || 0) - repSpentOnThisVote)
        })
        .eq('id', proposal_id);

      // Refund REP to user
      let newReputation = user.reputation;
      if (repSpentOnThisVote > 0) {
        newReputation = user.reputation + repSpentOnThisVote;

        await supabase
          .from('factory_users')
          .update({ reputation: newReputation })
          .eq('id', user.id);

        // Log the refund in rep history
        await supabase.from('factory_rep_history').insert({
          user_id: user.id,
          amount: repSpentOnThisVote,
          reason: 'vote_refund',
          proposal_id: proposal_id
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'vote_removed',
          refunded: repSpentOnThisVote,
          user: { ...user, reputation: newReputation }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== HANDLE ADDING VOTE (for/against) =====
    const newVoteNumber = currentVoteCount + 1;
    const repCost = getVoteCost(newVoteNumber);

    // Check if user has enough REP
    if (repCost > user.reputation) {
      return new Response(
        JSON.stringify({
          error: `Not enough REP. Need ${repCost} but have ${user.reputation}.`,
          required: repCost,
          available: user.reputation
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct REP from user
    const newReputation = user.reputation - repCost;

    if (repCost > 0) {
      await supabase
        .from('factory_users')
        .update({ reputation: newReputation })
        .eq('id', user.id);

      // Log the spend in rep history
      await supabase.from('factory_rep_history').insert({
        user_id: user.id,
        amount: -repCost,
        reason: 'vote_cast',
        proposal_id: proposal_id
      });
    }

    // Insert or update the vote
    // Convert direction to integer: 'for' = 1, 'against' = -1
    const voteDirection = direction === 'for' ? 1 : -1;

    const { error: insertErr } = await supabase
      .from('factory_votes')
      .upsert({
        proposal_id: proposal_id,
        user_id: user.id,
        vote_direction: voteDirection,
        vote_power: newVoteNumber, // Total votes from this user
        rep_spent: repCost
      }, {
        onConflict: 'proposal_id,user_id'
      });

    if (insertErr) {
      // Refund REP if vote failed
      if (repCost > 0) {
        await supabase
          .from('factory_users')
          .update({ reputation: user.reputation })
          .eq('id', user.id);
      }

      return new Response(
        JSON.stringify({ error: 'Failed to record vote', details: insertErr }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update proposal vote counts
    const updateField = direction === 'for' ? 'votes_for' : 'votes_against';

    await supabase
      .from('factory_proposals')
      .update({
        [updateField]: (proposal[updateField] || 0) + vote_power,
        total_rep_voted: (proposal.total_rep_voted || 0) + repCost
      })
      .eq('id', proposal_id);

    return new Response(
      JSON.stringify({
        success: true,
        action: 'vote_added',
        direction: direction,
        vote_number: newVoteNumber,
        rep_spent: repCost,
        user: { ...user, reputation: newReputation }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
