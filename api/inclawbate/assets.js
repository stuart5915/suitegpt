// Inclawbate — Stage Launch Asset
// POST /api/inclawbate/assets
// Authenticated: agent wallet JWT

import { authenticateRequest } from './auth-verify.js';

const CLAWS_BASE = 'https://clawn.ch/api/memory';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

const VALID_ASSET_TYPES = [
    'landing-page',
    'logo',
    'launch-post',
    'dexscreener-profile',
    'twitter-profile',
    'content-calendar',
    'farcaster-profile'
];

const REQUIRED_ASSETS = ['landing-page', 'logo', 'launch-post', 'dexscreener-profile'];

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
        const { projectId, assetType, content, metadata } = req.body;

        if (!projectId) return res.status(400).json({ error: 'Missing projectId' });
        if (!assetType || !VALID_ASSET_TYPES.includes(assetType)) {
            return res.status(400).json({ error: `Invalid assetType. Must be one of: ${VALID_ASSET_TYPES.join(', ')}` });
        }
        if (!content) return res.status(400).json({ error: 'Missing content' });

        // Verify project
        const result = await clawsCall({
            action: 'getByTag',
            tag: `project:${projectId}`,
            limit: 50
        });
        const docs = parseDocs(result);
        const project = docs.find(d => d.docType === 'project');

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.agentWallet !== auth.wallet) return res.status(403).json({ error: 'Access denied' });
        if (project.currentPhase !== 'build') {
            return res.status(400).json({ error: 'Can only stage assets in build phase' });
        }

        const now = new Date().toISOString();
        const assetId = uuid();

        const asset = {
            docType: 'asset',
            projectId,
            assetId,
            assetType,
            status: 'staged',
            content: typeof content === 'string' ? content : JSON.stringify(content),
            metadata: metadata || {},
            createdAt: now,
            updatedAt: now
        };

        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify(asset),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:asset',
                `asset:${assetType}`
            ]
        });

        // Check if all required assets are now staged
        const existingAssets = docs.filter(d => d.docType === 'asset');
        const allTypes = [...existingAssets.map(a => a.assetType), assetType];
        const uniqueTypes = [...new Set(allTypes)];
        const allStaged = REQUIRED_ASSETS.every(t => uniqueTypes.includes(t));

        // If all required assets are staged, move to reviewing
        if (allStaged && project.subState === 'preparing') {
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
                    `agent:${project.agentWallet}`,
                    'phase:build',
                    'status:active'
                ]
            });
        }

        // Chat message
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'chat-message',
                projectId,
                messageId: uuid(),
                role: 'system',
                phase: 'build',
                content: `Asset staged: ${assetType}${allStaged ? '. All required assets ready — awaiting review.' : ''}`,
                createdAt: now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:chat-message', 'phase:build']
        });

        return res.status(200).json({
            success: true,
            assetId,
            allRequiredStaged: allStaged,
            message: `${assetType} staged${allStaged ? '. All required assets ready for review.' : '.'}`
        });

    } catch (err) {
        console.error('Stage asset error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
