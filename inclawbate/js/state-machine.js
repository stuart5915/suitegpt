// Inclawbate — Incubation Phase State Machine

export const PHASES = {
    CONCEPT: 'concept',
    BUILD: 'build',
    LAUNCH: 'launch',
    GROW: 'grow'
};

export const SUB_STATES = {
    EXPLORING: 'exploring',
    REVIEWING: 'reviewing',
    PREPARING: 'preparing',
    READY: 'ready',
    EXECUTING: 'executing',
    ACTIVE: 'active'
};

export const ACTIONS = {
    SUBMIT_BRAND_OPTIONS: 'submit_brand_options',
    APPROVE_BRAND: 'approve_brand',
    REJECT_BRAND: 'reject_brand',
    STAGE_ASSETS: 'stage_assets',
    APPROVE_ASSETS: 'approve_assets',
    REJECT_ASSETS: 'reject_assets',
    TRIGGER_LAUNCH: 'trigger_launch',
    CONFIRM_LAUNCH: 'confirm_launch'
};

const REQUIRED_ASSETS = ['landing-page', 'logo', 'launch-post', 'dexscreener-profile'];

export function createProject(projectId, wallet, concept) {
    return {
        docType: 'project',
        projectId,
        agentWallet: wallet,
        concept,
        currentPhase: PHASES.CONCEPT,
        subState: SUB_STATES.EXPLORING,
        phaseGates: {
            concept: { status: 'pending', approvedAt: null, approvedBy: null },
            build: { status: 'pending', approvedAt: null, approvedBy: null },
            launch: { status: 'pending', approvedAt: null, approvedBy: null }
        },
        selectedBrand: null,
        tokenAddress: null,
        launchedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export function transition(project, action, payload = {}) {
    const p = { ...project, updatedAt: new Date().toISOString() };

    switch (action) {
        case ACTIONS.SUBMIT_BRAND_OPTIONS:
            if (p.currentPhase !== PHASES.CONCEPT) throw new Error('Can only submit brand options in concept phase');
            p.subState = SUB_STATES.REVIEWING;
            return p;

        case ACTIONS.APPROVE_BRAND:
            if (p.currentPhase !== PHASES.CONCEPT || p.subState !== SUB_STATES.REVIEWING) {
                throw new Error('No brand options to approve');
            }
            if (!payload.selectedOptionId) throw new Error('Must specify selectedOptionId');
            p.phaseGates.concept = {
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: payload.wallet || null
            };
            p.selectedBrand = payload.selectedOptionId;
            p.currentPhase = PHASES.BUILD;
            p.subState = SUB_STATES.PREPARING;
            return p;

        case ACTIONS.REJECT_BRAND:
            if (p.currentPhase !== PHASES.CONCEPT || p.subState !== SUB_STATES.REVIEWING) {
                throw new Error('No brand options to reject');
            }
            p.subState = SUB_STATES.EXPLORING;
            return p;

        case ACTIONS.STAGE_ASSETS:
            if (p.currentPhase !== PHASES.BUILD) throw new Error('Can only stage assets in build phase');
            // Check if all required assets are staged
            const stagedTypes = payload.stagedAssetTypes || [];
            const allStaged = REQUIRED_ASSETS.every(t => stagedTypes.includes(t));
            if (allStaged) {
                p.subState = SUB_STATES.REVIEWING;
            }
            return p;

        case ACTIONS.APPROVE_ASSETS:
            if (p.currentPhase !== PHASES.BUILD || p.subState !== SUB_STATES.REVIEWING) {
                throw new Error('Assets not ready for approval');
            }
            p.phaseGates.build = {
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: payload.wallet || null
            };
            p.currentPhase = PHASES.LAUNCH;
            p.subState = SUB_STATES.READY;
            return p;

        case ACTIONS.REJECT_ASSETS:
            if (p.currentPhase !== PHASES.BUILD || p.subState !== SUB_STATES.REVIEWING) {
                throw new Error('Assets not in review');
            }
            p.subState = SUB_STATES.PREPARING;
            return p;

        case ACTIONS.TRIGGER_LAUNCH:
            if (p.currentPhase !== PHASES.LAUNCH || p.subState !== SUB_STATES.READY) {
                throw new Error('Not ready to launch');
            }
            p.subState = SUB_STATES.EXECUTING;
            return p;

        case ACTIONS.CONFIRM_LAUNCH:
            if (p.currentPhase !== PHASES.LAUNCH || p.subState !== SUB_STATES.EXECUTING) {
                throw new Error('No launch in progress');
            }
            p.phaseGates.launch = {
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: 'system'
            };
            p.tokenAddress = payload.tokenAddress || null;
            p.launchedAt = new Date().toISOString();
            p.currentPhase = PHASES.GROW;
            p.subState = SUB_STATES.ACTIVE;
            return p;

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

export function getPhaseIndex(phase) {
    const order = [PHASES.CONCEPT, PHASES.BUILD, PHASES.LAUNCH, PHASES.GROW];
    return order.indexOf(phase);
}

export function isPhaseComplete(project, phase) {
    if (phase === PHASES.GROW) return false;
    return project.phaseGates[phase]?.status === 'approved';
}
