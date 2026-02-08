// Inclawbate — Approve Phase Gate
// POST /api/inclawbate/approve
// Authenticated: human wallet JWT

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

const REQUIRED_ASSETS = ['landing-page', 'logo', 'launch-post', 'dexscreener-profile'];

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
        const { projectId, phase, action, selectedOptionId, feedback } = req.body;

        if (!projectId || !phase || !action) {
            return res.status(400).json({ error: 'Missing projectId, phase, or action' });
        }
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be approve or reject' });
        }

        // Get project
        const result = await clawsCall({
            action: 'getByTag',
            tag: `project:${projectId}`,
            limit: 100
        });
        const docs = parseDocs(result);
        const project = docs.find(d => d.docType === 'project');

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const now = new Date().toISOString();
        let updatedProject = { ...project, updatedAt: now };
        let message = '';

        if (phase === 'concept') {
            if (project.currentPhase !== 'concept' || project.subState !== 'reviewing') {
                return res.status(400).json({ error: 'Brand options not ready for review' });
            }

            if (action === 'approve') {
                if (!selectedOptionId) {
                    return res.status(400).json({ error: 'Must specify selectedOptionId when approving brand' });
                }
                updatedProject.phaseGates.concept = { status: 'approved', approvedAt: now, approvedBy: auth.wallet };
                updatedProject.selectedBrand = selectedOptionId;
                updatedProject.currentPhase = 'build';
                updatedProject.subState = 'preparing';
                message = 'Brand approved. Moving to Build phase.';

                // Mark the selected brand option
                const brandOptions = docs.filter(d => d.docType === 'brand-option');
                for (const opt of brandOptions) {
                    const updated = { ...opt, selected: opt.optionId === selectedOptionId };
                    await clawsCall({
                        action: 'rememberFact',
                        text: JSON.stringify(updated),
                        tags: [
                            'inclawbate',
                            `project:${projectId}`,
                            'type:brand-option',
                            ...(updated.selected ? [`ticker:${updated.ticker}`] : [])
                        ]
                    });
                }
            } else {
                updatedProject.subState = 'exploring';
                message = feedback ? `Brand rejected: ${feedback}` : 'Brand rejected. Revise and resubmit.';
            }

        } else if (phase === 'build') {
            if (project.currentPhase !== 'build' || project.subState !== 'reviewing') {
                return res.status(400).json({ error: 'Assets not ready for review' });
            }

            if (action === 'approve') {
                // Verify all required assets are staged
                const assets = docs.filter(d => d.docType === 'asset');
                const stagedTypes = assets.map(a => a.assetType);
                const missing = REQUIRED_ASSETS.filter(t => !stagedTypes.includes(t));
                if (missing.length > 0) {
                    return res.status(400).json({ error: `Missing required assets: ${missing.join(', ')}` });
                }

                updatedProject.phaseGates.build = { status: 'approved', approvedAt: now, approvedBy: auth.wallet };
                updatedProject.currentPhase = 'launch';
                updatedProject.subState = 'ready';
                message = 'Assets approved. Ready to launch.';
            } else {
                updatedProject.subState = 'preparing';
                message = feedback ? `Assets rejected: ${feedback}` : 'Assets rejected. Revise and resubmit.';
            }

        } else {
            return res.status(400).json({ error: `Cannot approve phase: ${phase}` });
        }

        // Store updated project
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify(updatedProject),
            tags: [
                'inclawbate',
                `project:${projectId}`,
                'type:project',
                `agent:${project.agentWallet}`,
                `phase:${updatedProject.currentPhase}`,
                'status:active'
            ]
        });

        // Store approval record
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'approval',
                projectId,
                phase,
                action,
                selectedOptionId: selectedOptionId || null,
                feedback: feedback || null,
                approvedBy: auth.wallet,
                createdAt: now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:approval']
        });

        // Store chat message
        await clawsCall({
            action: 'rememberFact',
            text: JSON.stringify({
                docType: 'chat-message',
                projectId,
                messageId: uuid(),
                role: 'system',
                phase: updatedProject.currentPhase,
                content: message,
                createdAt: now
            }),
            tags: ['inclawbate', `project:${projectId}`, 'type:chat-message', `phase:${updatedProject.currentPhase}`]
        });

        return res.status(200).json({
            success: true,
            project: updatedProject,
            message
        });

    } catch (err) {
        console.error('Approve error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
