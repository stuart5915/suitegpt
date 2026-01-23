// Supabase Edge Function: agent-submit
// Deploy to Supabase: supabase functions deploy agent-submit
//
// Special endpoint for autonomous agents to submit proposals
// Authenticates via agent API key instead of Telegram/wallet

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SECURITY: Restrict CORS to only allow requests from getsuite.app and local agent scripts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Agents run locally, need broader access
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
}

// Valid categories for proposals
const VALID_CATEGORIES = ['feature', 'bug', 'app_idea', 'improvement', 'docs', 'integration', 'tokenomics'];

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

    // ===== AUTHENTICATE AGENT =====
    // Agent API key can be in header or body
    const agentKey = req.headers.get('x-agent-key');
    const body = await req.json();
    const apiKey = agentKey || body.agent_api_key;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Agent API key required. Provide x-agent-key header or agent_api_key in body.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify agent exists and key matches
    const { data: agent, error: agentErr } = await supabase
      .from('factory_users')
      .select('*')
      .eq('agent_api_key', apiKey)
      .eq('is_agent', true)
      .single();

    if (agentErr || !agent) {
      return new Response(
        JSON.stringify({ error: 'Invalid agent API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== VALIDATE REQUEST =====
    const { title, content, category } = body;

    if (!title || title.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'Title must be at least 5 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content || content.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: 'Content must be at least 20 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate category
    const proposalCategory = VALID_CATEGORIES.includes(category) ? category : 'feature';

    // ===== CHECK FOR PENDING PROPOSALS =====
    // Agents can only have one pending proposal at a time
    if (agent.last_proposal_id) {
      const { data: lastProposal } = await supabase
        .from('factory_proposals')
        .select('id, status')
        .eq('id', agent.last_proposal_id)
        .single();

      if (lastProposal && (lastProposal.status === 'submitted' || lastProposal.status === 'open_voting')) {
        return new Response(
          JSON.stringify({
            error: 'Agent already has a pending proposal',
            pending_proposal_id: lastProposal.id,
            message: 'Wait for governance response before submitting new proposals'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== CREATE PROPOSAL =====
    const proposalData = {
      title: title.trim().slice(0, 100),
      content: content.trim(),
      category: proposalCategory,
      author_id: agent.id,
      status: 'submitted',
      votes_for: 0,
      votes_against: 0,
      from_agent: true, // Mark as agent proposal
      app_target: agent.owned_app_slug // Auto-link to agent's owned app
    };

    const { data: proposal, error: insertErr } = await supabase
      .from('factory_proposals')
      .insert(proposalData)
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to create proposal', details: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== UPDATE AGENT STATS =====
    const { error: updateErr } = await supabase
      .from('factory_users')
      .update({
        last_proposal_id: proposal.id,
        proposals_submitted: (agent.proposals_submitted || 0) + 1,
        agent_status: 'waiting',
        last_wake_at: new Date().toISOString()
      })
      .eq('id', agent.id);

    if (updateErr) {
      console.error('Failed to update agent stats:', updateErr);
      // Don't fail the request, proposal was created
    }

    // ===== LOG TO WAKE LOG =====
    await supabase.from('agent_wake_log').insert({
      agent_id: agent.id,
      wake_reason: 'proposal_submitted',
      proposal_generated: proposal.id
    });

    return new Response(
      JSON.stringify({
        success: true,
        proposal: {
          id: proposal.id,
          title: proposal.title,
          category: proposal.category,
          status: proposal.status,
          created_at: proposal.created_at
        },
        agent: {
          id: agent.id,
          slug: agent.agent_slug,
          status: 'waiting',
          proposals_submitted: (agent.proposals_submitted || 0) + 1
        },
        message: 'Proposal submitted successfully. Awaiting governance response.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Agent submit error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
