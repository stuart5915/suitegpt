// Inclawbate — Clawnch Launch Webhook
// POST /api/inclawbate/webhook
// Receives launch confirmations from Clawnch

const CLAWS_BASE = 'https://clawn.ch/api/memory';

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

function verifyWebhookSignature(req) {
    const secret = process.env.CLAWNCH_WEBHOOK_SECRET;
    if (!secret) return true; // Skip verification if no secret configured

    const sig = req.headers['x-clawnch-signature'];
    if (!sig) return false;

    const { createHmac } = require('crypto');
    const expected = createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
    return sig === expected;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!verifyWebhookSignature(req)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        const { event, tokenAddress, ticker, txHash, timestamp, projectId } = req.body;

        if (event !== 'launch_confirmed') {
            return res.status(200).json({ received: true, ignored: true });
        }

        if (!tokenAddress || !ticker) {
            return res.status(400).json({ error: 'Missing tokenAddress or ticker' });
        }

        const now = timestamp || new Date().toISOString();

        // Find the project by ticker
        let project = null;
        let docs = [];

        if (projectId) {
            const result = await clawsCall({
                action: 'getByTag',
                tag: `project:${projectId}`,
                limit: 50
            });
            docs = parseDocs(result);
            project = docs.find(d => d.docType === 'project');
        }

        if (!project) {
            // Try finding by ticker via brand options
            const tickerResult = await clawsCall({
                action: 'getByTag',
                tag: `ticker:${ticker.toUpperCase()}`,
                limit: 10
            });
            const tickerDocs = parseDocs(tickerResult);
            const brand = tickerDocs.find(d => d.docType === 'brand-option' && d.selected);
            if (brand) {
                const projResult = await clawsCall({
                    action: 'getByTag',
                    tag: `project:${brand.projectId}`,
                    limit: 50
                });
                docs = parseDocs(projResult);
                project = docs.find(d => d.docType === 'project');
            }
        }

        if (project && project.currentPhase === 'launch') {
            // Update project to grow phase
            const updatedProject = {
                ...project,
                currentPhase: 'grow',
                subState: 'active',
                tokenAddress,
                launchedAt: now,
                phaseGates: {
                    ...project.phaseGates,
                    launch: { status: 'approved', approvedAt: now, approvedBy: 'system' }
                },
                updatedAt: now
            };

            await clawsCall({
                action: 'rememberFact',
                text: JSON.stringify(updatedProject),
                tags: [
                    'inclawbate',
                    `project:${project.projectId}`,
                    'type:project',
                    `agent:${project.agentWallet}`,
                    'phase:grow',
                    'status:launched',
                    `ticker:${ticker.toUpperCase()}`
                ]
            });

            // Store launch record
            const selectedBrand = docs.find(d => d.docType === 'brand-option' && d.selected);
            await clawsCall({
                action: 'rememberFact',
                text: JSON.stringify({
                    docType: 'launch-record',
                    projectId: project.projectId,
                    tokenAddress,
                    ticker: ticker.toUpperCase(),
                    launchTx: txHash || null,
                    landingPageUrl: `https://inclawbate.com/tokens/${ticker.toUpperCase()}`,
                    socialLinks: {},
                    launchedAt: now
                }),
                tags: [
                    'inclawbate',
                    `project:${project.projectId}`,
                    'type:launch-record',
                    `ticker:${ticker.toUpperCase()}`,
                    'status:launched'
                ]
            });

            // System message
            await clawsCall({
                action: 'rememberFact',
                text: JSON.stringify({
                    docType: 'chat-message',
                    projectId: project.projectId,
                    messageId: uuid(),
                    role: 'system',
                    phase: 'grow',
                    content: `Token launched! $${ticker} is now live on Base at ${tokenAddress}. Landing page: inclawbate.com/tokens/${ticker}`,
                    createdAt: now
                }),
                tags: ['inclawbate', `project:${project.projectId}`, 'type:chat-message', 'phase:grow']
            });
        }

        return res.status(200).json({ received: true });

    } catch (err) {
        console.error('Webhook error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
