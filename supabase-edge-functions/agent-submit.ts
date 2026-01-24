// Supabase Edge Function: agent-submit v2
// Deploy to Supabase: supabase functions deploy agent-submit
//
// Special endpoint for autonomous agents to submit proposals, updates, assistance requests, and completions
// v2: Supports submission_type for execution mode

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SECURITY: Restrict CORS to only allow requests from getsuite.app and local agent scripts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Agents run locally, need broader access
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
}

// Valid categories for proposals
const VALID_CATEGORIES = ['feature', 'bug', 'app_idea', 'improvement', 'docs', 'integration', 'tokenomics'];

// Valid submission types (v2)
const VALID_SUBMISSION_TYPES = ['proposal', 'work_update', 'assistance_request', 'completion', 'small_telos_proposal'];

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
    const { title, content, category, submission_type, assistance_needed, parent_proposal_id } = body;

    // Validate submission type (v2)
    const validatedSubmissionType = VALID_SUBMISSION_TYPES.includes(submission_type) ? submission_type : 'proposal';

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

    // For assistance requests, require assistance_needed
    if (validatedSubmissionType === 'assistance_request' && !assistance_needed) {
      return new Response(
        JSON.stringify({ error: 'assistance_needed field is required for assistance requests' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate category
    const proposalCategory = VALID_CATEGORIES.includes(category) ? category : 'feature';

    // ===== CHECK FOR PENDING PROPOSALS (only for new proposals) =====
    // Agents can only have one pending PROPOSAL at a time
    // But they can submit updates/completions/assistance requests anytime
    if (validatedSubmissionType === 'proposal' && agent.last_proposal_id) {
      const { data: lastProposal } = await supabase
        .from('factory_proposals')
        .select('id, status, submission_type')
        .eq('id', agent.last_proposal_id)
        .single();

      if (lastProposal && lastProposal.submission_type === 'proposal' &&
          (lastProposal.status === 'submitted' || lastProposal.status === 'open_voting')) {
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

    // ===== CREATE SUBMISSION =====
    const proposalData: Record<string, any> = {
      title: title.trim().slice(0, 100),
      content: content.trim(),
      category: proposalCategory,
      author_id: agent.id,
      status: 'submitted',
      votes_for: 0,
      votes_against: 0,
      from_agent: true,
      app_target: agent.owned_app_slug,
      submission_type: validatedSubmissionType
    };

    // Add optional fields
    if (assistance_needed) {
      proposalData.assistance_needed = assistance_needed.trim();
    }

    if (parent_proposal_id) {
      proposalData.parent_proposal_id = parent_proposal_id;
    }

    const { data: proposal, error: insertErr } = await supabase
      .from('factory_proposals')
      .insert(proposalData)
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to create submission', details: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== UPDATE AGENT STATS & STATE =====
    const updateData: Record<string, any> = {
      last_wake_at: new Date().toISOString()
    };

    // Update based on submission type
    switch (validatedSubmissionType) {
      case 'proposal':
        updateData.last_proposal_id = proposal.id;
        updateData.proposals_submitted = (agent.proposals_submitted || 0) + 1;
        updateData.agent_status = 'waiting';
        updateData.execution_state = 'idle';
        break;

      case 'small_telos_proposal':
        // Small telos proposal - agent waiting for approval
        updateData.last_proposal_id = proposal.id;
        updateData.proposals_submitted = (agent.proposals_submitted || 0) + 1;
        updateData.agent_status = 'waiting';
        updateData.execution_state = 'idle';
        updateData.small_telos_status = 'proposed';
        break;

      case 'work_update':
        // Progress update - agent continues executing
        updateData.agent_status = 'working';
        updateData.execution_state = 'executing';
        break;

      case 'assistance_request':
        // Agent is blocked
        updateData.agent_status = 'blocked';
        updateData.execution_state = 'blocked';
        break;

      case 'completion':
        // Task complete - agent becomes idle
        updateData.agent_status = 'idle';
        updateData.execution_state = 'idle';
        updateData.current_task_id = null;
        break;
    }

    const { error: updateErr } = await supabase
      .from('factory_users')
      .update(updateData)
      .eq('id', agent.id);

    if (updateErr) {
      console.error('Failed to update agent stats:', updateErr);
      // Don't fail the request, submission was created
    }

    // ===== LOG TO WAKE LOG =====
    await supabase.from('agent_wake_log').insert({
      agent_id: agent.id,
      wake_reason: `${validatedSubmissionType}_submitted`,
      proposal_generated: proposal.id
    });

    // ===== LOG TO EXECUTION LOG (v2) =====
    if (validatedSubmissionType !== 'proposal') {
      const eventType = validatedSubmissionType === 'assistance_request' ? 'blocked' :
                        validatedSubmissionType === 'completion' ? 'completed' : 'progress';

      await supabase.from('agent_execution_log').insert({
        agent_id: agent.id,
        task_id: agent.current_task_id || parent_proposal_id,
        event_type: eventType,
        message: title.trim(),
        event_data: { submission_id: proposal.id, content_preview: content.trim().slice(0, 200) }
      });
    }

    // Build response message based on type
    const responseMessages: Record<string, string> = {
      proposal: 'Proposal submitted successfully. Awaiting governance response.',
      small_telos_proposal: 'Small telos proposal submitted. Awaiting approval to begin execution.',
      work_update: 'Progress update submitted. Continue working.',
      assistance_request: 'Assistance request submitted. Waiting for human help.',
      completion: 'Task completion submitted. Awaiting confirmation.'
    };

    return new Response(
      JSON.stringify({
        success: true,
        submission: {
          id: proposal.id,
          title: proposal.title,
          category: proposal.category,
          status: proposal.status,
          submission_type: validatedSubmissionType,
          created_at: proposal.created_at
        },
        agent: {
          id: agent.id,
          slug: agent.agent_slug,
          status: updateData.agent_status,
          execution_state: updateData.execution_state,
          proposals_submitted: updateData.proposals_submitted || agent.proposals_submitted
        },
        message: responseMessages[validatedSubmissionType]
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
