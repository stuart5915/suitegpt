// Inclawbate — Post-Launch Growth Actions
// POST /api/inclawbate/grow
// Authenticated: agent wallet JWT

import { authenticateRequest } from './auth-verify.js';

const CLAWS_BASE = 'https://clawn.ch/api/memory';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

const VALID_ACTION_TYPES = [
    'content-post',
    'analytics-snapshot',
    'fee-claim',
    'community-update',
    'narrative-update',
    'milestone'
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
        const { projectId, actionType, content } = req.body;

        if (!projectId) return res.status(400).json({ error: 'Missing projectId' });
        if (!actionType || !VALID_ACTION_TYPES.includes(actionType)) {
            return res.status(400).json({ error: `Invalid actionType. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` });
        }

        // Verify project
        const result = await clawsCall({
            action: 'getByTag',
            tag: `project:${projectId}`,
            limit: 10
        });
        const docs = parseDocs(result);
        const project = docs.find(d => d.docType === 'project');

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.agentWallet !== auth.wallet) return res.status(403).json({ error: 'Access denied' });
        if (project.currentPhase !== 'grow') {
            return res.status(400).json({ error: 'Project is not in grow phase' });
        }

        const now = new Date().toISOString();
        const actionId = uuid();

        // Store grow action
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'grow-action',
                projectId,
                actionId,
                actionType,
                content: typeof content === 'string' ? content : JSON.stringify(content),
                createdAt: now
            }),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:grow-action',
                `action:${actionType}`
            ]
        });

        // Chat message
        const actionLabels = {
            'content-post': 'Content posted',
            'analytics-snapshot': 'Analytics updated',
            'fee-claim': 'Fees claimed',
            'community-update': 'Community update',
            'narrative-update': 'Narrative updated',
            'milestone': 'Milestone reached'
        };

        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'chat-message',
                projectId,
                messageId: uuid(),
                role: 'agent',
                phase: 'grow',
                content: actionLabels[actionType] || actionType,
                createdAt: now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:chat-message', 'phase:grow']
        });

        return res.status(200).json({
            success: true,
            actionId,
            message: `Growth action recorded: ${actionType}`
        });

    } catch (err) {
        console.error('Grow action error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
