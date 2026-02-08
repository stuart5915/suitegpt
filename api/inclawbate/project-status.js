// Inclawbate — Get Project Status
// GET /api/inclawbate/project-status?projectId=uuid
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const auth = authenticateRequest(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    try {
        // Get all documents for this project
        const result = await clawsCall({
            action: 'getByTag',
            tag: `project:${projectId}`,
            limit: 100
        });

        const docs = parseDocs(result);

        const project = docs.find(d => d.docType === 'project');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Verify ownership
        if (project.agentWallet !== auth.wallet) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const brandOptions = docs.filter(d => d.docType === 'brand-option');
        const assets = docs.filter(d => d.docType === 'asset');
        const launchRecord = docs.find(d => d.docType === 'launch-record');
        const approvals = docs.filter(d => d.docType === 'approval');
        const recentMessages = docs
            .filter(d => d.docType === 'chat-message')
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .slice(-30);

        return res.status(200).json({
            success: true,
            project,
            brandOptions,
            assets,
            launchRecord,
            approvals,
            recentMessages
        });

    } catch (err) {
        console.error('Project status error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
