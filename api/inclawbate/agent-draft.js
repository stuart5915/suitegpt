// Inclawbate — Agent Draft Posts API
// GET  ?project_id=X  — get or generate draft for next scheduled post
// POST { project_id, action: "regenerate|approve|edit|reject", draft_id?, tweet_text? }

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';
import { generateTweet } from './_agent-utils.js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'http://localhost:3000',
    'http://localhost:5500',
];

function verifyOwnership(project, user) {
    const userWallet = (user.wallet_address || '').toLowerCase();
    return project.creator_profile_id === user.sub ||
        (userWallet && project.creator_wallet === userWallet);
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // GET — fetch drafts for a date (calendar mode) or single draft (legacy)
    if (req.method === 'GET') {
        const { project_id, date } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id required' });

        const { data: project } = await supabase
            .from('projects')
            .select('*')
            .eq('id', project_id)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (!verifyOwnership(project, user)) return res.status(403).json({ error: 'Not your project' });

        // Calendar mode — fetch drafts for a specific date
        if (date) {
            const dayStart = date + 'T00:00:00.000Z';
            const dayEnd = date + 'T23:59:59.999Z';
            const { data: drafts } = await supabase
                .from('agent_draft_posts')
                .select('*')
                .eq('project_id', project_id)
                .gte('scheduled_for', dayStart)
                .lte('scheduled_for', dayEnd)
                .in('status', ['draft', 'approved', 'edited', 'posted'])
                .order('scheduled_for', { ascending: true });

            return res.status(200).json({ drafts: drafts || [] });
        }

        // Legacy single-draft mode
        const { data: existing } = await supabase
            .from('agent_draft_posts')
            .select('*')
            .eq('project_id', project_id)
            .is('scheduled_for', null)
            .in('status', ['draft', 'approved', 'edited'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(200).json({ draft: existing[0] });
        }

        // No draft — generate one
        try {
            const result = await generateTweet(project);

            const { data: draft, error } = await supabase
                .from('agent_draft_posts')
                .insert({
                    project_id,
                    tweet_text: result.text,
                    content_angle: result.content_angle,
                    status: 'draft'
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ draft, generated: true });
        } catch (e) {
            return res.status(500).json({ error: e.message || 'Failed to generate draft' });
        }
    }

    // POST — actions on drafts
    if (req.method === 'POST') {
        const { project_id, action, draft_id, tweet_text, date, slot_index } = req.body || {};
        if (!project_id || !action) return res.status(400).json({ error: 'project_id and action required' });

        const { data: project } = await supabase
            .from('projects')
            .select('*')
            .eq('id', project_id)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (!verifyOwnership(project, user)) return res.status(403).json({ error: 'Not your project' });

        // Generate day — create drafts for all empty slots on a given date
        if (action === 'generate_day') {
            if (!date) return res.status(400).json({ error: 'date required' });
            const times = project.agent_schedule_times || [];
            if (!times.length) return res.status(400).json({ error: 'No schedule times set' });

            // Get existing drafts for this day
            const dayStart = date + 'T00:00:00.000Z';
            const dayEnd = date + 'T23:59:59.999Z';
            const { data: existing } = await supabase
                .from('agent_draft_posts')
                .select('*')
                .eq('project_id', project_id)
                .gte('scheduled_for', dayStart)
                .lte('scheduled_for', dayEnd)
                .in('status', ['draft', 'approved', 'edited', 'posted']);

            const existingSlots = new Set((existing || []).map(d => {
                const h = new Date(d.scheduled_for).getUTCHours();
                return times.indexOf(h);
            }));

            const drafts = [...(existing || [])];
            for (let i = 0; i < times.length; i++) {
                if (existingSlots.has(i)) continue;
                try {
                    const result = await generateTweet(project);
                    const scheduledFor = date + 'T' + String(times[i]).padStart(2, '0') + ':00:00.000Z';
                    const { data: draft, error } = await supabase
                        .from('agent_draft_posts')
                        .insert({
                            project_id,
                            tweet_text: result.text,
                            content_angle: result.content_angle,
                            status: 'draft',
                            scheduled_for: scheduledFor
                        })
                        .select()
                        .single();
                    if (!error && draft) drafts.push(draft);
                } catch (e) { /* skip slot on error */ }
            }

            // Sort by scheduled_for
            drafts.sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
            return res.status(200).json({ drafts });
        }

        // Regenerate slot — regenerate a specific slot on a date
        if (action === 'regenerate_slot') {
            if (draft_id) {
                await supabase
                    .from('agent_draft_posts')
                    .update({ status: 'expired', updated_at: new Date().toISOString() })
                    .eq('id', draft_id)
                    .eq('project_id', project_id);
            }
            try {
                const result = await generateTweet(project);
                const times = project.agent_schedule_times || [];
                const utcHour = times[slot_index] !== undefined ? times[slot_index] : 12;
                const targetDate = date || new Date().toISOString().split('T')[0];
                const scheduledFor = targetDate + 'T' + String(utcHour).padStart(2, '0') + ':00:00.000Z';
                const { data: draft, error } = await supabase
                    .from('agent_draft_posts')
                    .insert({
                        project_id,
                        tweet_text: result.text,
                        content_angle: result.content_angle,
                        status: 'draft',
                        scheduled_for: scheduledFor
                    })
                    .select()
                    .single();
                if (error) return res.status(500).json({ error: error.message });
                return res.status(200).json({ draft });
            } catch (e) {
                return res.status(500).json({ error: e.message || 'Failed to generate' });
            }
        }

        // Regenerate — expire old draft, generate new (legacy single-draft)
        if (action === 'regenerate') {
            // Expire existing drafts
            await supabase
                .from('agent_draft_posts')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('project_id', project_id)
                .in('status', ['draft', 'edited']);

            try {
                const result = await generateTweet(project);

                const { data: draft, error } = await supabase
                    .from('agent_draft_posts')
                    .insert({
                        project_id,
                        tweet_text: result.text,
                        content_angle: result.content_angle,
                        status: 'draft'
                    })
                    .select()
                    .single();

                if (error) return res.status(500).json({ error: error.message });
                return res.status(200).json({ draft, generated: true });
            } catch (e) {
                return res.status(500).json({ error: e.message || 'Failed to generate' });
            }
        }

        // Approve
        if (action === 'approve') {
            if (!draft_id) return res.status(400).json({ error: 'draft_id required' });
            const { data, error } = await supabase
                .from('agent_draft_posts')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('id', draft_id)
                .eq('project_id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ draft: data });
        }

        // Edit
        if (action === 'edit') {
            if (!draft_id || !tweet_text) return res.status(400).json({ error: 'draft_id and tweet_text required' });
            if (tweet_text.length > 280) return res.status(400).json({ error: 'Tweet too long (max 280)' });

            const { data, error } = await supabase
                .from('agent_draft_posts')
                .update({ tweet_text, status: 'edited', updated_at: new Date().toISOString() })
                .eq('id', draft_id)
                .eq('project_id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ draft: data });
        }

        // Reject
        if (action === 'reject') {
            if (!draft_id) return res.status(400).json({ error: 'draft_id required' });
            const { data, error } = await supabase
                .from('agent_draft_posts')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', draft_id)
                .eq('project_id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ draft: data });
        }

        return res.status(400).json({ error: 'Unknown action. Use: regenerate, approve, edit, reject' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
