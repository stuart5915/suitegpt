// Inclawbate — Create Incubation Project
// POST /api/inclawbate/projects
// Authenticated: wallet JWT

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
        const { concept, initialThoughts } = req.body;

        if (!concept || concept.length < 10) {
            return res.status(400).json({ error: 'Concept must be at least 10 characters' });
        }
        if (concept.length > 2000) {
            return res.status(400).json({ error: 'Concept must be under 2000 characters' });
        }

        const projectId = uuid();
        const now = new Date().toISOString();

        const project = {
            docType: 'project',
            projectId,
            agentWallet: auth.wallet,
            concept,
            initialThoughts: initialThoughts || null,
            currentPhase: 'concept',
            subState: 'exploring',
            phaseGates: {
                concept: { status: 'pending', approvedAt: null, approvedBy: null },
                build: { status: 'pending', approvedAt: null, approvedBy: null },
                launch: { status: 'pending', approvedAt: null, approvedBy: null }
            },
            selectedBrand: null,
            tokenAddress: null,
            launchedAt: null,
            createdAt: now,
            updatedAt: now
        };

        // Store in CLAWS
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify(project),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:project',
                `agent:${auth.wallet}`,
                'phase:concept',
                'status:active'
            ]
        });

        // Store initial system message
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'chat-message',
                projectId,
                messageId: uuid(),
                role: 'system',
                phase: 'concept',
                content: `Project created. Concept: ${concept}`,
                createdAt: now
            }),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:chat-message',
                'phase:concept'
            ]
        });

        return res.status(201).json({
            success: true,
            projectId,
            phase: 'concept',
            message: 'Project created. Agent can begin concept exploration.'
        });

    } catch (err) {
        console.error('Create project error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
