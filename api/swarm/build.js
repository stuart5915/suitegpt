// Swarm Portal — Build Agent App
// POST /api/swarm/build
// Body: { proposal_id }
// Takes an approved proposal, generates a full HTML app via Gemini, saves it

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

function extractCodeBlock(text) {
    // Try to extract HTML from code block
    const htmlBlock = text.match(/```html\s*([\s\S]*?)```/);
    if (htmlBlock) return htmlBlock[1].trim();

    const anyBlock = text.match(/```\s*([\s\S]*?)```/);
    if (anyBlock) return anyBlock[1].trim();

    // If text starts with <!DOCTYPE or <html, use it directly
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        return text.trim();
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
        const { proposal_id } = req.body;

        if (!proposal_id) {
            return res.status(400).json({ error: 'proposal_id is required' });
        }

        // Get the proposal
        const { data: proposal, error: pErr } = await supabase
            .from('factory_proposals')
            .select('id, title, content, category, status, author_id')
            .eq('id', proposal_id)
            .single();

        if (pErr || !proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        if (proposal.status !== 'passed') {
            return res.status(400).json({ error: 'Proposal must be approved first (status: ' + proposal.status + ')' });
        }

        // Get the agent
        const { data: agent } = await supabase
            .from('factory_users')
            .select('id, display_name, agent_slug, agent_role, telos_objective')
            .eq('id', proposal.author_id)
            .single();

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Update agent status to building
        await supabase
            .from('factory_users')
            .update({ agent_status: 'working', last_active_at: new Date().toISOString() })
            .eq('id', agent.id);

        // Call Gemini to generate the full app
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        const buildPrompt = `You are ${agent.display_name}, an AI app builder agent. Build a complete, production-ready single-page web application.

APP REQUIREMENTS:
Title: ${proposal.title}
Description: ${proposal.content}

TECHNICAL REQUIREMENTS:
- Return ONLY the complete HTML file, no explanation
- Must be a single self-contained HTML file with inline CSS and JavaScript
- Use a modern dark theme (background: #0a0a0f, cards: rgba(255,255,255,0.03), accent: #6366f1, text: #e2e8f0)
- Font: system-ui or Inter from Google Fonts CDN
- Must be mobile-responsive
- Must be fully functional with working interactivity
- Use localStorage for any data persistence
- Include smooth transitions and clean micro-interactions
- Add a small header with the app name
- Make it actually useful and feature-complete, not just a demo
- Minimum 200 lines of well-structured code

Return the complete HTML starting with <!DOCTYPE html>`;

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: buildPrompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 32768
                    }
                })
            }
        );

        const geminiData = await geminiResponse.json();

        if (!geminiResponse.ok) {
            console.error('Gemini build error:', geminiData);
            return res.status(502).json({ error: 'Gemini API error', detail: geminiData.error?.message });
        }

        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const usageMeta = geminiData.usageMetadata || {};
        const tokensUsed = usageMeta.totalTokenCount || 0;

        const appCode = extractCodeBlock(rawText);

        if (!appCode || appCode.length < 100) {
            return res.status(502).json({ error: 'Gemini failed to generate valid app code', raw_length: rawText.length });
        }

        // Generate slug from title
        const slug = proposal.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);

        // Save to agent_apps table
        const { data: app, error: appErr } = await supabase
            .from('agent_apps')
            .insert({
                agent_id: agent.id,
                proposal_id: proposal.id,
                name: proposal.title,
                slug: slug,
                description: proposal.content,
                code: appCode,
                icon_bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            })
            .select()
            .single();

        if (appErr) {
            console.error('Agent app insert error:', appErr);
            return res.status(500).json({ error: 'Failed to save app', detail: appErr.message });
        }

        // Register in suite_operators so it shows in Community Apps
        const { error: opErr } = await supabase
            .from('suite_operators')
            .insert({
                user_app_id: app.id,
                name: proposal.title,
                description: proposal.content,
                slug: slug,
                icon_bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                status: 'active'
            });

        if (opErr) {
            console.error('Suite operator insert error:', opErr);
            // App was still saved, just won't show in community grid
        }

        // Update agent - accumulate tokens, set status
        await supabase
            .from('factory_users')
            .update({
                agent_status: 'idle',
                last_active_at: new Date().toISOString()
            })
            .eq('id', agent.id);

        // Update proposal to link to the built app
        await supabase
            .from('factory_proposals')
            .update({ status: 'completed' })
            .eq('id', proposal.id);

        return res.status(200).json({
            success: true,
            app: {
                id: app.id,
                name: app.name,
                slug: app.slug,
                description: app.description,
                code_length: appCode.length
            },
            tokens_used: tokensUsed,
            agent_name: agent.display_name,
            message: `${agent.display_name} built "${proposal.title}" — it's live in Community Apps!`
        });

    } catch (error) {
        console.error('Build error:', error);
        return res.status(500).json({ error: 'Server error', detail: error.message });
    }
}
