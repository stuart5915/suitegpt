// Supabase Edge Function: factory-submit
// Deploy to Supabase: supabase functions deploy factory-submit

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple AI title/category generation using OpenAI or fallback
// Valid categories: feature, bug, app_idea, improvement, docs, integration, tokenomics
const VALID_CATEGORIES = ['feature', 'bug', 'app_idea', 'improvement', 'docs', 'integration', 'tokenomics'];

async function generateTitleAndCategory(content: string): Promise<{ title: string; category: string }> {
  // Try OpenAI if available
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: 'You generate concise titles and categories for governance proposals. Categories must be one of: feature, bug, app_idea, improvement, docs, integration, tokenomics. Respond ONLY with JSON: {"title": "...", "category": "..."}'
          }, {
            role: 'user',
            content: `Generate a title (max 60 chars) and category for this proposal:\n\n${content.slice(0, 500)}`
          }],
          max_tokens: 100,
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(text);
        const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'feature';
        return {
          title: parsed.title?.slice(0, 60) || content.slice(0, 50) + '...',
          category
        };
      }
    } catch (e) {
      console.error('OpenAI error:', e);
    }
  }

  // Fallback: simple extraction
  const firstLine = content.split('\n')[0].slice(0, 60);
  const title = firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine;

  // Simple keyword-based category detection
  const lowerContent = content.toLowerCase();
  let category = 'feature'; // default
  if (lowerContent.includes('bug') || lowerContent.includes('fix') || lowerContent.includes('broken') || lowerContent.includes('error')) {
    category = 'bug';
  } else if (lowerContent.includes('improve') || lowerContent.includes('better') || lowerContent.includes('enhance')) {
    category = 'improvement';
  } else if (lowerContent.includes('app idea') || lowerContent.includes('new app') || lowerContent.includes('build app')) {
    category = 'app_idea';
  } else if (lowerContent.includes('doc') || lowerContent.includes('guide') || lowerContent.includes('tutorial')) {
    category = 'docs';
  } else if (lowerContent.includes('integrat') || lowerContent.includes('connect') || lowerContent.includes('api')) {
    category = 'integration';
  } else if (lowerContent.includes('token') || lowerContent.includes('reward') || lowerContent.includes('incentive')) {
    category = 'tokenomics';
  }

  return { title, category };
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
    const { content, section, app_slug, wallet_address, telegram_auth } = body;

    if (!content || content.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Content must be at least 10 characters' }),
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
            reputation: 10
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
            reputation: 10
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

    // ===== GENERATE TITLE AND CATEGORY =====
    const { title, category } = await generateTitleAndCategory(content);

    // ===== CREATE PROPOSAL =====
    const proposalData: any = {
      title,
      content: content.trim(),
      category,
      section: section || 'business',
      author_id: user.id,
      author_name: user.display_name,
      status: 'submitted',
      votes_for: 0,
      votes_against: 0
    };

    // Add app_slug if provided
    if (app_slug) {
      proposalData.app_slug = app_slug;
    }

    const { data: proposal, error: insertErr } = await supabase
      .from('factory_proposals')
      .insert(proposalData)
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to create proposal', details: insertErr }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== UPDATE USER STATS =====
    await supabase
      .from('factory_users')
      .update({
        active_submissions: (user.active_submissions || 0) + 1
      })
      .eq('id', user.id);

    // ===== AWARD REP FOR FIRST PROPOSAL =====
    if ((user.active_submissions || 0) === 0) {
      const repBonus = 5;
      await supabase
        .from('factory_users')
        .update({ reputation: user.reputation + repBonus })
        .eq('id', user.id);

      await supabase.from('factory_rep_history').insert({
        user_id: user.id,
        amount: repBonus,
        reason: 'first_proposal',
        proposal_id: proposal.id
      });

      user.reputation += repBonus;
    }

    return new Response(
      JSON.stringify({
        success: true,
        proposal: proposal,
        user: user
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
