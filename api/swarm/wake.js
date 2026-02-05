// Swarm Portal — Wake Agent
// POST /api/swarm/wake
// Body: { agent_slug: "stchewmin" }
// Triggers an agent to generate a proposal via Gemini AI

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://getsuite.app',
    'https://www.getsuite.app',
    'https://suitegpt.app',
    'https://www.suitegpt.app',
    'http://localhost:3000',
    'http://localhost:5500'
];

function extractJSON(text) {
    // Try to extract JSON from markdown code blocks or raw text
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1].trim());
        } catch (_) { /* fall through */ }
    }

    // Try direct JSON parse
    try {
        return JSON.parse(text.trim());
    } catch (_) { /* fall through */ }

    // Try to find JSON object in text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (_) { /* fall through */ }
    }

    return null;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { agent_slug } = req.body;

        if (!agent_slug || typeof agent_slug !== 'string' || agent_slug.trim().length < 1) {
            return res.status(400).json({ error: 'agent_slug is required' });
        }

        // Look up the agent
        const { data: agent, error: agentError } = await supabase
            .from('factory_users')
            .select('id, display_name, telos_objective, agent_role, agent_status, proposals_submitted')
            .eq('agent_slug', agent_slug.trim())
            .eq('is_agent', true)
            .single();

        if (agentError || !agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        if (agent.agent_status === 'blocked') {
            return res.status(403).json({ error: 'Agent is blocked' });
        }

        // Call Gemini API to generate a proposal
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        const prompt = `You are ${agent.display_name}, a ${agent.agent_role || 'general'} agent in the SUITE app ecosystem. Your mission: ${agent.telos_objective || 'contribute to the SUITE ecosystem'}. Generate a concrete, actionable proposal for your next task. Return JSON with: { "title": string (max 80 chars), "description": string (detailed plan, 50-200 chars), "category": one of ["feature", "improvement", "bug", "app_idea", "content", "marketing", "social"] }`;

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 1024
                    }
                })
            }
        );

        const geminiData = await geminiResponse.json();

        if (!geminiResponse.ok) {
            console.error('Gemini API error:', geminiData);
            return res.status(502).json({ error: 'Gemini API error', detail: geminiData.error?.message || 'Unknown error' });
        }

        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!rawText) {
            return res.status(502).json({ error: 'Gemini returned empty response' });
        }

        // Parse JSON from Gemini response
        const parsed = extractJSON(rawText);

        if (!parsed || !parsed.title) {
            return res.status(502).json({
                error: 'Failed to parse Gemini response as JSON',
                raw_response: rawText.substring(0, 500)
            });
        }

        const validCategories = ['feature', 'improvement', 'bug', 'app_idea', 'content', 'marketing', 'social'];
        const proposalTitle = String(parsed.title).substring(0, 80);
        const proposalDescription = String(parsed.description || '').substring(0, 500);
        const proposalCategory = validCategories.includes(parsed.category) ? parsed.category : 'feature';

        // Insert the proposal
        const { data: proposal, error: insertError } = await supabase
            .from('factory_proposals')
            .insert({
                author_id: agent.id,
                title: proposalTitle,
                content: proposalDescription,
                category: proposalCategory,
                status: 'submitted',
                from_agent: true,
                submission_type: 'proposal'
            })
            .select()
            .single();

        if (insertError) {
            console.error('Proposal insert error:', insertError);
            return res.status(500).json({ error: 'Failed to insert proposal', detail: insertError.message || insertError.code || JSON.stringify(insertError) });
        }

        // Update agent status and last_active_at
        await supabase
            .from('factory_users')
            .update({
                agent_status: 'waiting',
                last_active_at: new Date().toISOString()
            })
            .eq('id', agent.id);

        // Increment proposals_submitted
        await supabase
            .from('factory_users')
            .update({
                proposals_submitted: (agent.proposals_submitted || 0) + 1
            })
            .eq('id', agent.id);

        return res.status(200).json({
            success: true,
            agent_name: agent.display_name,
            proposal: {
                id: proposal.id,
                title: proposalTitle,
                description: proposalDescription,
                category: proposalCategory
            },
            message: 'Agent woke up and proposed a new task'
        });

    } catch (error) {
        console.error('Wake error:', error);
        return res.status(500).json({ error: 'Server error', detail: error.message || String(error) });
    }
}
