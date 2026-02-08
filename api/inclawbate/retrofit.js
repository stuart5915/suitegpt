// Inclawbate — Create Retrofit Project
// POST /api/inclawbate/retrofit
// Authenticated: wallet JWT
// Creates a project directly in grow phase for existing tokens

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

async function clawnchGet(path) {
    const res = await fetch(`${CLAWNCH_BASE}${path}`);
    if (!res.ok) return null;
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
        const { tokenAddress, ticker, existingAssets } = req.body;

        if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
            return res.status(400).json({ error: 'Invalid token address' });
        }
        if (!ticker || !/^[A-Z0-9]{2,10}$/.test(ticker)) {
            return res.status(400).json({ error: 'Invalid ticker' });
        }

        const now = new Date().toISOString();
        const projectId = uuid();

        // Try to pull existing token data from Clawnch
        let tokenData = null;
        const launches = await clawnchGet(`/launches?address=${tokenAddress}`);
        if (launches && launches.data && launches.data.length > 0) {
            tokenData = launches.data[0];
        }

        const project = {
            docType: 'project',
            projectId,
            agentWallet: auth.wallet,
            concept: tokenData?.description || `Retrofit of existing token $${ticker}`,
            currentPhase: 'grow',
            subState: 'active',
            phaseGates: {
                concept: { status: 'approved', approvedAt: now, approvedBy: 'retrofit' },
                build: { status: 'approved', approvedAt: now, approvedBy: 'retrofit' },
                launch: { status: 'approved', approvedAt: now, approvedBy: 'retrofit' }
            },
            selectedBrand: null,
            tokenAddress,
            launchedAt: tokenData?.createdAt || now,
            createdAt: now,
            updatedAt: now
        };

        // Store project
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify(project),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:project',
                `agent:${auth.wallet}`,
                'phase:grow',
                'status:launched',
                `ticker:${ticker}`
            ]
        });

        // Store brand option from existing data
        const brandOption = {
            docType: 'brand-option',
            projectId,
            optionId: uuid(),
            name: tokenData?.name || ticker,
            ticker,
            tagline: '',
            colorPrimary: '#8b5cf6',
            colorSecondary: '#06b6d4',
            logoUrl: existingAssets?.logoUrl || tokenData?.image || null,
            narrative: tokenData?.description || '',
            selected: true,
            createdAt: now
        };

        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify(brandOption),
            tags: ['inclawbate', `project:${projectId}`, 'type:brand-option', `ticker:${ticker}`]
        });

        // Store launch record
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'launch-record',
                projectId,
                tokenAddress,
                ticker,
                landingPageUrl: `https://inclawbate.com/tokens/${ticker}`,
                socialLinks: {
                    twitter: existingAssets?.twitter || null,
                    website: existingAssets?.website || null
                },
                launchedAt: tokenData?.createdAt || now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:launch-record', `ticker:${ticker}`, 'status:launched']
        });

        // System message
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'chat-message',
                projectId,
                messageId: uuid(),
                role: 'system',
                phase: 'grow',
                content: `Retrofit project created for $${ticker}. Token landing page: inclawbate.com/tokens/${ticker}. Agent can now manage growth and marketing.`,
                createdAt: now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:chat-message', 'phase:grow']
        });

        return res.status(201).json({
            success: true,
            projectId,
            phase: 'grow',
            message: `Retrofit project created for $${ticker}. Ready for growth phase.`
        });

    } catch (err) {
        console.error('Retrofit error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
