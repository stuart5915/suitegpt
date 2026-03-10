// Generate AI marketing plan for a project
// POST /api/inclawbate/generate-marketing
// Free for all authenticated users (no credit deduction)

import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a crypto marketing strategist who creates actionable launch plans for token projects.

Given a project's details, generate a structured marketing plan with these sections:

## Twitter Strategy
- Content pillars (3-4 themes to post about)
- Posting cadence recommendation
- 3 example tweet drafts

## Community Growth
- Telegram/Discord tactics
- Engagement strategies
- Collaboration ideas

## Launch Timeline
- Pre-launch (1-2 weeks before)
- Launch day
- Post-launch (first 2 weeks)

## Key Messages
- Elevator pitch (1 sentence)
- 3 talking points
- Call to action

Keep it practical and crypto-native. No corporate jargon. Under 1500 words.`;

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { projectName, tokenSymbol, uniqueValue, targetAudience } = req.body || {};

    if (!projectName || !tokenSymbol) {
        return res.status(400).json({ error: 'Missing projectName or tokenSymbol' });
    }

    const userMessage = `Project: ${projectName}
Token: $${tokenSymbol}
What makes it unique: ${uniqueValue || 'Not specified'}
Target audience: ${targetAudience || 'Crypto-native users'}

Generate a marketing plan:`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 2000,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Failed to generate plan'
            });
        }

        const plan = data.content?.[0]?.text || '';
        return res.status(200).json({ plan: plan.trim() });

    } catch (err) {
        console.error('generate-marketing error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
