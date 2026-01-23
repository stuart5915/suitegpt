#!/usr/bin/env node
/**
 * SUITE Autonomous Agent Wake Script
 *
 * Usage: node scripts/wake-agent.js <agent-slug>
 * Example: node scripts/wake-agent.js foodvitals-agent
 *
 * This script:
 * 1. Checks if agent has a pending proposal awaiting response
 * 2. Syncs feedback from governance if responded
 * 3. Runs Claude in the agent's directory with context
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const https = require('https');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const AGENTS_DIR = path.join(__dirname, '..', 'agents');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logError(message) {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logSuccess(message) {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

/**
 * Fetch from Supabase
 */
async function supabaseFetch(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);

        const reqOptions = {
            method: options.method || 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': options.prefer || 'return=representation',
                ...options.headers
            }
        };

        const req = https.request(url, reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

/**
 * Load agent state from local file
 */
function loadAgentState(agentSlug) {
    const statePath = path.join(AGENTS_DIR, agentSlug, 'state.json');

    if (!fs.existsSync(statePath)) {
        throw new Error(`Agent state file not found: ${statePath}`);
    }

    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

/**
 * Save agent state to local file
 */
function saveAgentState(agentSlug, state) {
    const statePath = path.join(AGENTS_DIR, agentSlug, 'state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Fetch proposal status from Supabase
 */
async function getProposal(proposalId) {
    const data = await supabaseFetch(`factory_proposals?id=eq.${proposalId}`);
    return data && data.length > 0 ? data[0] : null;
}

/**
 * Check if agent should wake up
 */
async function shouldAgentWake(state) {
    // If no last proposal, agent can wake up
    if (!state.last_proposal) {
        return { canWake: true, reason: 'no_prior_proposal' };
    }

    // If last proposal still pending, don't wake
    if (state.last_proposal.status === 'submitted' || state.last_proposal.status === 'open_voting') {
        // Check if governance has responded
        const proposal = await getProposal(state.last_proposal.id);

        if (!proposal) {
            return { canWake: false, reason: 'proposal_not_found' };
        }

        // Still waiting
        if (proposal.status === 'submitted' || proposal.status === 'open_voting') {
            return {
                canWake: false,
                reason: 'waiting_for_response',
                message: `Proposal "${state.last_proposal.title}" is still awaiting response`
            };
        }

        // Governance has responded - return the feedback
        return {
            canWake: true,
            reason: 'feedback_received',
            proposal: proposal,
            feedback: proposal.agent_feedback || proposal.reject_reason || null
        };
    }

    // Proposal was already processed
    return { canWake: true, reason: 'ready' };
}

/**
 * Update state with feedback from governance
 */
function updateStateWithFeedback(state, proposal, feedback) {
    // Update last proposal status
    state.last_proposal.status = proposal.status;
    state.last_proposal.feedback = feedback;

    // Add to feedback history
    state.feedback_history.push({
        proposal_id: proposal.id,
        title: state.last_proposal.title,
        outcome: proposal.status,
        feedback: feedback,
        implemented: proposal.status === 'implemented',
        responded_at: proposal.feedback_at || new Date().toISOString()
    });

    // Update stats
    if (proposal.status === 'passed' || proposal.status === 'implemented') {
        state.approved_proposals++;
    } else if (proposal.status === 'rejected') {
        state.rejected_proposals++;
    }

    state.current_status = 'idle';

    return state;
}

/**
 * Run Claude in the agent's directory
 */
function runClaude(agentSlug, wakeReason) {
    const agentDir = path.join(AGENTS_DIR, agentSlug);

    // Build the wake prompt
    let prompt = 'Wake up and do your job. ';

    if (wakeReason === 'feedback_received') {
        prompt = 'Wake up. Your last proposal has received a response. Read your state.json to see the feedback, then generate your next proposal. ';
    } else if (wakeReason === 'no_prior_proposal') {
        prompt = 'Wake up. This is your first wake cycle. Read your telos-objective.md to understand your mission, then generate your first proposal. ';
    }

    prompt += 'Remember: Submit ONE proposal, then STOP.';

    logStep('4', `Running Claude in ${agentDir}`);
    log(`Prompt: "${prompt}"`, 'dim');

    // Run claude command
    try {
        // Using spawn to allow interactive output
        const claude = spawn('claude', [prompt], {
            cwd: agentDir,
            stdio: 'inherit',
            shell: true
        });

        claude.on('close', (code) => {
            if (code === 0) {
                logSuccess('Claude session completed');
            } else {
                logError(`Claude exited with code ${code}`);
            }
        });

        claude.on('error', (err) => {
            logError(`Failed to start Claude: ${err.message}`);
        });

    } catch (err) {
        logError(`Failed to run Claude: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Main wake function
 */
async function wakeAgent(agentSlug) {
    log(`\n${'='.repeat(50)}`, 'cyan');
    log(`  SUITE Agent Wake: ${agentSlug}`, 'bright');
    log(`${'='.repeat(50)}\n`, 'cyan');

    // Validate agent exists
    const agentDir = path.join(AGENTS_DIR, agentSlug);
    if (!fs.existsSync(agentDir)) {
        logError(`Agent directory not found: ${agentDir}`);
        logError(`Available agents: ${fs.readdirSync(AGENTS_DIR).join(', ')}`);
        process.exit(1);
    }

    // Load agent state
    logStep('1', 'Loading agent state...');
    let state;
    try {
        state = loadAgentState(agentSlug);
        log(`   Current status: ${state.current_status}`, 'dim');
        log(`   Total proposals: ${state.total_proposals}`, 'dim');
    } catch (err) {
        logError(`Failed to load state: ${err.message}`);
        process.exit(1);
    }

    // Check if agent should wake
    logStep('2', 'Checking if agent should wake...');
    const wakeCheck = await shouldAgentWake(state);

    if (!wakeCheck.canWake) {
        log(`\n${colors.yellow}Agent cannot wake: ${wakeCheck.reason}${colors.reset}`);
        if (wakeCheck.message) {
            log(`   ${wakeCheck.message}`, 'dim');
        }
        log('\nWaiting for human response on pending proposal.', 'yellow');
        process.exit(0);
    }

    log(`   Can wake: ${wakeCheck.reason}`, 'green');

    // Update state with feedback if received
    if (wakeCheck.reason === 'feedback_received') {
        logStep('3', 'Processing feedback...');
        log(`   Status: ${wakeCheck.proposal.status}`, 'dim');
        if (wakeCheck.feedback) {
            log(`   Feedback: "${wakeCheck.feedback}"`, 'dim');
        }

        state = updateStateWithFeedback(state, wakeCheck.proposal, wakeCheck.feedback);
        saveAgentState(agentSlug, state);
        logSuccess('State updated with feedback');
    } else {
        logStep('3', 'No feedback to process');
    }

    // Update wake timestamp
    state.last_wake = new Date().toISOString();
    saveAgentState(agentSlug, state);

    // Run Claude
    runClaude(agentSlug, wakeCheck.reason);
}

// CLI Entry Point
const args = process.argv.slice(2);

if (args.length === 0) {
    log('\nUsage: node wake-agent.js <agent-slug>', 'yellow');
    log('\nExample:', 'dim');
    log('  node wake-agent.js foodvitals-agent', 'dim');
    log('\nAvailable agents:', 'dim');

    if (fs.existsSync(AGENTS_DIR)) {
        const agents = fs.readdirSync(AGENTS_DIR).filter(f =>
            fs.statSync(path.join(AGENTS_DIR, f)).isDirectory()
        );
        agents.forEach(a => log(`  - ${a}`, 'dim'));
    }

    process.exit(1);
}

const agentSlug = args[0];

// Check for required environment variables
if (!SUPABASE_ANON_KEY) {
    log('\nWarning: SUPABASE_ANON_KEY not set. Governance sync will not work.', 'yellow');
    log('Set it with: export SUPABASE_ANON_KEY=your-key\n', 'dim');
}

// Run
wakeAgent(agentSlug).catch(err => {
    logError(`Wake failed: ${err.message}`);
    process.exit(1);
});
