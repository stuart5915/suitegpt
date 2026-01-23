// Cadence AI Hiring Operations API
// POST /api/cadence-hiring
// Handles AI-powered operations for the hiring system

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://getsuite.app',
    'https://www.getsuite.app',
    'http://localhost:3000',
    'http://localhost:5500'
];

export default async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, data } = req.body;

    try {
        switch (action) {
            case 'generate_job_description':
                return await generateJobDescription(data, res);

            case 'refresh_job_copy':
                return await refreshJobCopy(data, res);

            case 'generate_hiring_post':
                return await generateHiringPost(data, res);

            case 'update_loop_stats':
                return await updateLoopStats(data, res);

            case 'schedule_next_post':
                return await scheduleNextPost(data, res);

            default:
                return res.status(400).json({ error: 'Unknown action' });
        }
    } catch (error) {
        console.error('Cadence hiring API error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}

async function generateJobDescription(data, res) {
    const { jobTitle, platform } = data;

    // Default job description template
    const description = `Join SUITE as an ${jobTitle || 'App Operator'} and earn 90% of your app's revenue!

What You'll Do:
- Take ownership of a real app in the SUITE ecosystem
- Use AI marketing tools (Cadence) to grow your app's user base
- Earn revenue based on your app's performance
- Get support from the SUITE community and AI assistants

What We Offer:
- 90% revenue share - you keep most of what you earn
- Marketing budget included (10,000 SUITE credits/month)
- No coding required - we handle the tech
- Flexible hours (5-10 hrs/week minimum)
- Real ownership, not just a gig

Requirements:
- Motivation to build something meaningful
- Dedication to spend time growing your app
- Willingness to learn and adapt

About SUITE:
SUITE is an ecosystem where anyone can build and everyone gets paid. We handle the technical development while operators like you focus on growing and promoting apps.

Apply now at: getsuite.app/become-operator

Platform: ${formatPlatformName(platform)}`;

    return res.status(200).json({
        success: true,
        description
    });
}

async function refreshJobCopy(data, res) {
    const { postingId } = data;

    // Get the current posting
    const { data: posting, error } = await supabase
        .from('job_board_postings')
        .select('*')
        .eq('id', postingId)
        .single();

    if (error || !posting) {
        return res.status(404).json({ error: 'Posting not found' });
    }

    // Generate fresh copy (in production, this would use AI)
    const variations = [
        `Ready to own your own app business? SUITE App Operators earn 90% revenue share with marketing budget included. No coding needed!`,
        `Looking for real ownership, not just a gig? Become a SUITE App Operator - 90% revenue, AI marketing tools, and community support.`,
        `Turn your motivation into money. SUITE operators earn 90% of their app's revenue. We handle the code, you grow the business.`
    ];

    const newDescription = variations[Math.floor(Math.random() * variations.length)] +
        `\n\nApply: getsuite.app/become-operator`;

    // Update the posting
    const { error: updateError } = await supabase
        .from('job_board_postings')
        .update({
            description: newDescription,
            updated_at: new Date().toISOString()
        })
        .eq('id', postingId);

    if (updateError) {
        return res.status(500).json({ error: 'Failed to update posting' });
    }

    return res.status(200).json({
        success: true,
        description: newDescription
    });
}

async function generateHiringPost(data, res) {
    const { loopType } = data;

    // Get the loop config
    const { data: config, error } = await supabase
        .from('cadence_hiring_config')
        .select('*')
        .eq('loop_type', loopType)
        .single();

    if (error || !config) {
        return res.status(404).json({ error: 'Loop config not found' });
    }

    // Get a random template or generate one
    const templates = config.message_templates || [];
    let post;

    if (templates.length > 0) {
        post = templates[Math.floor(Math.random() * templates.length)];
    } else {
        const defaultTemplates = [
            "Want to run your own app business? No coding needed. SUITE is hiring App Operators - earn 90% revenue from apps you manage. Marketing budget included. Apply: getsuite.app/become-operator",
            "SUITE is hiring! Become an App Operator and earn 90% of your app's revenue. No coding required - we handle the tech, you grow the business. Apply now: getsuite.app/become-operator",
            "Looking for a side hustle with real ownership? SUITE App Operators earn 90% revenue share + get marketing budget. Take ownership of an app today: getsuite.app/become-operator"
        ];
        post = defaultTemplates[Math.floor(Math.random() * defaultTemplates.length)];
    }

    return res.status(200).json({
        success: true,
        post,
        platforms: config.platforms
    });
}

async function updateLoopStats(data, res) {
    const { loopType, incrementPosts, incrementApplications } = data;

    // Get current stats
    const { data: config, error } = await supabase
        .from('cadence_hiring_config')
        .select('stats')
        .eq('loop_type', loopType)
        .single();

    if (error || !config) {
        return res.status(404).json({ error: 'Loop config not found' });
    }

    const currentStats = config.stats || { posts_count: 0, applications_count: 0 };
    const newStats = {
        posts_count: (currentStats.posts_count || 0) + (incrementPosts || 0),
        applications_count: (currentStats.applications_count || 0) + (incrementApplications || 0)
    };

    // Update stats
    const { error: updateError } = await supabase
        .from('cadence_hiring_config')
        .update({
            stats: newStats,
            updated_at: new Date().toISOString()
        })
        .eq('loop_type', loopType);

    if (updateError) {
        return res.status(500).json({ error: 'Failed to update stats' });
    }

    return res.status(200).json({
        success: true,
        stats: newStats
    });
}

async function scheduleNextPost(data, res) {
    const { loopType } = data;

    // Get the loop config
    const { data: config, error } = await supabase
        .from('cadence_hiring_config')
        .select('*')
        .eq('loop_type', loopType)
        .single();

    if (error || !config) {
        return res.status(404).json({ error: 'Loop config not found' });
    }

    // Calculate next post time based on frequency
    const now = new Date();
    let nextPost = new Date(now);

    switch (config.posting_frequency) {
        case 'twice_daily':
            // Post at 10 AM and 6 PM
            if (now.getHours() < 10) {
                nextPost.setHours(10, 0, 0, 0);
            } else if (now.getHours() < 18) {
                nextPost.setHours(18, 0, 0, 0);
            } else {
                nextPost.setDate(nextPost.getDate() + 1);
                nextPost.setHours(10, 0, 0, 0);
            }
            break;

        case 'weekly':
            // Post on Mondays at 10 AM
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
            nextPost.setDate(nextPost.getDate() + daysUntilMonday);
            nextPost.setHours(10, 0, 0, 0);
            break;

        case 'daily':
        default:
            // Post at 10 AM
            if (now.getHours() >= 10) {
                nextPost.setDate(nextPost.getDate() + 1);
            }
            nextPost.setHours(10, 0, 0, 0);
            break;
    }

    // Update next post time
    const { error: updateError } = await supabase
        .from('cadence_hiring_config')
        .update({
            next_post_at: nextPost.toISOString(),
            last_post_at: now.toISOString(),
            updated_at: now.toISOString()
        })
        .eq('loop_type', loopType);

    if (updateError) {
        return res.status(500).json({ error: 'Failed to schedule next post' });
    }

    return res.status(200).json({
        success: true,
        next_post_at: nextPost.toISOString()
    });
}

function formatPlatformName(platform) {
    const names = {
        cryptojobslist: 'CryptoJobsList',
        web3career: 'Web3.career',
        indeed: 'Indeed',
        linkedin: 'LinkedIn Jobs',
        glassdoor: 'Glassdoor',
        wellfound: 'Wellfound',
        remote3: 'Remote3'
    };
    return names[platform] || platform || 'General';
}
