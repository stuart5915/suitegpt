// Inclawbate — Submit Brand Options
// POST /api/inclawbate/brand-options
// Authenticated: agent wallet JWT

import { authenticateRequest } from './auth-verify.js';

const CLAWS_BASE = 'https://clawn.ch/api/memory';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

async function clawsCall(body) {
    const res = await fetch(CLAWS_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CLAWS_API_KEY}`
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`CLAWS error: ${res.status}`);
    return res.json();
}

function uuid() {
    return crypto.randomUUID();
}

function parseDocs(clawsResult) {
    if (!clawsResult || !clawsResult.episodes) return [];
    return clawsResult.episodes
        .map(ep => {
            try { return JSON.parse(ep.text || ep.content); } catch { return null; }
        })
        .filter(Boolean);
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

    const auth = authenticateRequest(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { projectId, options } = req.body;

        if (!projectId) return res.status(400).json({ error: 'Missing projectId' });
        if (!options || !Array.isArray(options) || options.length < 2 || options.length > 5) {
            return res.status(400).json({ error: 'Must provide 2-5 brand options' });
        }

        // Verify project exists and is in concept phase
        const result = await clawsCall({
            action: 'getByTag',
            tag: `project:${projectId}`,
            limit: 10
        });
        const docs = parseDocs(result);
        const project = docs.find(d => d.docType === 'project');

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.agentWallet !== auth.wallet) return res.status(403).json({ error: 'Access denied' });
        if (project.currentPhase !== 'concept') {
            return res.status(400).json({ error: 'Project is not in concept phase' });
        }

        const now = new Date().toISOString();
        const optionIds = [];

        // Validate and store each option
        for (const opt of options) {
            if (!opt.name || !opt.ticker || !opt.tagline) {
                return res.status(400).json({ error: 'Each option must have name, ticker, and tagline' });
            }
            if (!/^[A-Z0-9]{2,10}$/.test(opt.ticker)) {
                return res.status(400).json({ error: `Invalid ticker: ${opt.ticker}. Must be 2-10 uppercase chars.` });
            }

            const optionId = uuid();
            optionIds.push(optionId);

            const brandOption = {
                docType: 'brand-option',
                projectId,
                optionId,
                name: opt.name,
                ticker: opt.ticker,
                tagline: opt.tagline,
                colorPrimary: opt.colorPrimary || '#8b5cf6',
                colorSecondary: opt.colorSecondary || '#06b6d4',
                logoPrompt: opt.logoPrompt || null,
                logoUrl: opt.logoUrl || null,
                narrative: opt.narrative || '',
                description: opt.description || '',
                selected: false,
                createdAt: now
            };

            await clawsCall({
                action: 'rememberFact',
                text: JSON.stringify(brandOption),
                tags: [
                    'inclawbate',
                    `project:${projectId}`,
                    'type:brand-option'
                ]
            });
        }

        // Update project sub-state to reviewing
        const updatedProject = {
            ...project,
            subState: 'reviewing',
            updatedAt: now
        };
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify(updatedProject),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:project',
                `agent:${auth.wallet}`,
                'phase:concept',
                'status:active'
            ]
        });

        // Add system message
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'chat-message',
                projectId,
                messageId: uuid(),
                role: 'system',
                phase: 'concept',
                content: `${options.length} brand options submitted. Waiting for human review.`,
                createdAt: now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:chat-message', 'phase:concept']
        });

        return res.status(200).json({
            success: true,
            optionIds,
            message: 'Brand options submitted. Waiting for human review.'
        });

    } catch (err) {
        console.error('Brand options error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
