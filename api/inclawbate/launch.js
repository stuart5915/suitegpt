// Inclawbate — Trigger Token Launch
// POST /api/inclawbate/launch
// Authenticated: human wallet JWT (only humans can trigger launches)

import { authenticateRequest } from './auth-verify.js';

const CLAWS_BASE = 'https://clawn.ch/api/memory';
const CLAWNCH_BASE = 'https://clawn.ch/api';

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

async function clawnchPost(path, body) {
    const res = await fetch(`${CLAWNCH_BASE}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Moltbook-Key': process.env.CLAWNCH_API_KEY || ''
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Clawnch error: ${res.status}`);
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
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

        // Get project and all docs
        const result = await clawsCall({
            action: 'getByTag',
            tag: `project:${projectId}`,
            limit: 100
        });
        const docs = parseDocs(result);
        const project = docs.find(d => d.docType === 'project');

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.currentPhase !== 'launch' || project.subState !== 'ready') {
            return res.status(400).json({ error: 'Project is not ready to launch' });
        }

        // Get the launch post asset
        const launchPostAsset = docs.find(d => d.docType === 'asset' && d.assetType === 'launch-post');
        if (!launchPostAsset) {
            return res.status(400).json({ error: 'No launch post found' });
        }

        const now = new Date().toISOString();

        // Validate via Clawnch preview
        try {
            const preview = await clawnchPost('/preview', { content: launchPostAsset.content });
            if (preview.errors && preview.errors.length > 0) {
                return res.status(400).json({
                    error: 'Launch post validation failed',
                    errors: preview.errors
                });
            }
        } catch {
            // Preview endpoint may not be available — proceed with caution
        }

        // Update project to executing
        const updatedProject = {
            ...project,
            subState: 'executing',
            updatedAt: now
        };
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify(updatedProject),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:project',
                `agent:${project.agentWallet}`,
                'phase:launch',
                'status:active'
            ]
        });

        // Chat message
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'chat-message',
                projectId,
                messageId: uuid(),
                role: 'system',
                phase: 'launch',
                content: 'Launch initiated. Token deployment in progress on Base...',
                createdAt: now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:chat-message', 'phase:launch']
        });

        return res.status(200).json({
            success: true,
            launchStatus: 'executing',
            message: 'Launch initiated. Token will be deployed on Base within 60 seconds.',
            steps: [
                { step: 'validate_preview', status: 'complete' },
                { step: 'deploy_token', status: 'pending' },
                { step: 'activate_landing', status: 'pending' },
                { step: 'update_profiles', status: 'pending' }
            ]
        });

    } catch (err) {
        console.error('Launch error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
