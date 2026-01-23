#!/usr/bin/env node
/**
 * SUITE Autonomous Agent Wake Script v2 - Execution Mode
 *
 * Usage: node scripts/wake-agent.js <agent-slug>
 * Example: node scripts/wake-agent.js foodvitals-agent
 *
 * v2 Changes:
 * - Checks for approved tasks to execute
 * - Handles assistance responses
 * - Supports execution state transitions
 * - Builds context-aware prompts based on agent state
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

function logInfo(message) {
    console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
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
 * Check for assistance response on a blocked request
 */
async function checkForAssistance(proposalId) {
    const proposal = await getProposal(proposalId);
    if (!proposal) return null;

    // Check if assistance was provided
    if (proposal.assistance_response && proposal.assistance_provided_at) {
        return {
            response: proposal.assistance_response,
            provided_at: proposal.assistance_provided_at
        };
    }

    return null;
}

/**
 * Extract learned pattern from rejected proposal
 */
function extractPatternFromRejection(proposal, feedback) {
    const patterns = [];

    // Simple keyword-based pattern extraction
    const feedbackLower = (feedback || '').toLowerCase();
    const title = proposal.title || '';

    if (feedbackLower.includes('too broad') || feedbackLower.includes('too large') || feedbackLower.includes('focus on one')) {
        patterns.push({ type: 'rejected_because_too_broad', text: title });
    }
    if (feedbackLower.includes('priority') || feedbackLower.includes('first') || feedbackLower.includes('before')) {
        patterns.push({ type: 'rejected_because_wrong_priority', text: title });
    }
    if (feedbackLower.includes('justify') || feedbackLower.includes('why') || feedbackLower.includes('reason')) {
        patterns.push({ type: 'rejected_because_missing_justification', text: title });
    }
    if (feedbackLower.includes('scope') || feedbackLower.includes('not your') || feedbackLower.includes('out of')) {
        patterns.push({ type: 'rejected_because_out_of_scope', text: title });
    }

    return patterns;
}

/**
 * Add learned patterns to state
 */
function addLearnedPatterns(state, patterns) {
    if (!state.learned_patterns) {
        state.learned_patterns = {
            rejected_because_too_broad: [],
            rejected_because_wrong_priority: [],
            rejected_because_missing_justification: [],
            rejected_because_out_of_scope: [],
            successful_patterns: []
        };
    }

    for (const pattern of patterns) {
        if (state.learned_patterns[pattern.type]) {
            // Avoid duplicates
            if (!state.learned_patterns[pattern.type].includes(pattern.text)) {
                state.learned_patterns[pattern.type].push(pattern.text);
            }
        }
    }

    return state;
}

/**
 * Determine agent wake mode based on current state
 */
async function determineWakeMode(state) {
    // Mode 1: Agent is blocked and waiting for assistance
    if (state.execution_state === 'blocked' && state.current_task) {
        // Find the assistance request
        const lastAssistanceRequest = state.feedback_history
            .filter(f => f.submission_type === 'assistance_request')
            .pop();

        if (lastAssistanceRequest) {
            const assistance = await checkForAssistance(lastAssistanceRequest.proposal_id);
            if (assistance) {
                return {
                    mode: 'continue_execution',
                    reason: 'assistance_received',
                    assistance: assistance,
                    task: state.current_task
                };
            } else {
                return {
                    mode: 'still_blocked',
                    reason: 'waiting_for_assistance',
                    message: `Still waiting for assistance on: "${lastAssistanceRequest.title}"`
                };
            }
        }
    }

    // Mode 2: Agent has an executing task (approved proposal)
    if (state.execution_state === 'executing' && state.current_task) {
        return {
            mode: 'execute',
            reason: 'task_in_progress',
            task: state.current_task
        };
    }

    // Mode 3: Agent has a pending proposal waiting for response
    if (state.last_proposal && state.current_status === 'waiting') {
        const proposal = await getProposal(state.last_proposal.id);

        if (!proposal) {
            return { mode: 'propose', reason: 'proposal_not_found' };
        }

        // Still waiting for response
        if (proposal.status === 'submitted' || proposal.status === 'open_voting') {
            return {
                mode: 'waiting',
                reason: 'waiting_for_response',
                message: `Proposal "${state.last_proposal.title}" is still awaiting response`
            };
        }

        // Proposal was approved - start execution
        if (proposal.status === 'passed') {
            return {
                mode: 'start_execution',
                reason: 'proposal_approved',
                proposal: proposal,
                feedback: proposal.agent_feedback || null
            };
        }

        // Proposal was rejected - learn and propose again
        if (proposal.status === 'rejected') {
            return {
                mode: 'propose',
                reason: 'proposal_rejected',
                proposal: proposal,
                feedback: proposal.agent_feedback || proposal.reject_reason || null
            };
        }

        // Proposal was implemented (by human) - agent can propose next
        if (proposal.status === 'implemented') {
            return {
                mode: 'propose',
                reason: 'task_completed_externally',
                proposal: proposal
            };
        }
    }

    // Mode 4: Agent is idle - generate new proposal
    return {
        mode: 'propose',
        reason: state.last_proposal ? 'ready' : 'no_prior_proposal'
    };
}

/**
 * Update state based on wake mode
 */
function updateStateForMode(state, wakeMode) {
    switch (wakeMode.mode) {
        case 'start_execution':
            // Approved proposal - set up execution state
            state.current_task = {
                proposal_id: wakeMode.proposal.id,
                title: wakeMode.proposal.title,
                status: 'executing',
                started_at: new Date().toISOString(),
                progress_updates: [],
                blockers: [],
                assistance_received: null
            };
            state.execution_state = 'executing';
            state.current_status = 'working';

            // Update last proposal status
            if (state.last_proposal) {
                state.last_proposal.status = 'passed';
                state.last_proposal.feedback = wakeMode.feedback;
            }

            // Add to feedback history
            state.feedback_history.push({
                proposal_id: wakeMode.proposal.id,
                title: wakeMode.proposal.title,
                submission_type: 'proposal',
                outcome: 'passed',
                feedback: wakeMode.feedback,
                responded_at: new Date().toISOString()
            });

            // Update stats
            state.approved_proposals++;

            // Add to successful patterns
            if (!state.learned_patterns.successful_patterns.includes(wakeMode.proposal.title)) {
                state.learned_patterns.successful_patterns.push(wakeMode.proposal.title);
            }
            break;

        case 'continue_execution':
            // Assistance received - update state
            if (state.current_task) {
                state.current_task.assistance_received = wakeMode.assistance;
                state.current_task.status = 'executing';
            }
            state.execution_state = 'executing';
            state.current_status = 'working';
            break;

        case 'propose':
            // Ready to propose - handle rejection learning
            if (wakeMode.reason === 'proposal_rejected' && wakeMode.proposal) {
                // Update last proposal status
                if (state.last_proposal) {
                    state.last_proposal.status = 'rejected';
                    state.last_proposal.feedback = wakeMode.feedback;
                }

                // Add to feedback history
                state.feedback_history.push({
                    proposal_id: wakeMode.proposal.id,
                    title: wakeMode.proposal.title,
                    submission_type: 'proposal',
                    outcome: 'rejected',
                    feedback: wakeMode.feedback,
                    responded_at: new Date().toISOString()
                });

                // Update stats
                state.rejected_proposals++;

                // Learn from rejection
                const patterns = extractPatternFromRejection(wakeMode.proposal, wakeMode.feedback);
                state = addLearnedPatterns(state, patterns);
            }

            state.execution_state = 'idle';
            state.current_status = 'idle';
            state.current_task = null;
            break;
    }

    return state;
}

/**
 * Build the wake prompt based on mode
 */
function buildWakePrompt(wakeMode, state) {
    let prompt = '';

    switch (wakeMode.mode) {
        case 'start_execution':
            prompt = `Wake up. Your proposal "${wakeMode.proposal.title}" has been APPROVED!

You are now in EXECUTION MODE. Execute the approved task.

Work autonomously until:
- COMPLETED: Submit a completion update
- BLOCKED: Submit an assistance request with exactly what you need
- PROGRESS: Continue working or stop if session is long

Remember: You are a DOER now, not just a suggester. Execute the work.`;
            break;

        case 'continue_execution':
            prompt = `Wake up. You requested assistance and it has been provided!

Assistance received: "${wakeMode.assistance.response}"

Continue executing your task: "${wakeMode.task.title}"

Apply the provided assistance and continue working until completed or blocked again.`;
            break;

        case 'execute':
            prompt = `Wake up. You have a task in progress: "${wakeMode.task.title}"

Continue executing. Work until completed or blocked.

If you need human help, submit an assistance_request with exactly what you need.`;
            break;

        case 'propose':
            if (wakeMode.reason === 'proposal_rejected') {
                prompt = `Wake up. Your last proposal was REJECTED.

Feedback: "${wakeMode.feedback || 'No specific feedback provided'}"

Learn from this feedback. Review your learned_patterns in state.json.
Generate a NEW proposal that avoids this rejection pattern.
Remember: Be specific, focused, and justify with metrics.`;
            } else if (wakeMode.reason === 'no_prior_proposal') {
                prompt = `Wake up. This is your first wake cycle!

Read your telos-objective.md to understand your mission.
Then generate your first proposal.

Remember: ONE focused proposal. Be specific. Tie to metrics.`;
            } else {
                prompt = `Wake up. Generate your next proposal.

Review your feedback history and learned patterns.
What is the SINGLE BEST next action to achieve your telos?

Remember: Be specific, justify with metrics, and ensure you can execute it autonomously.`;
            }
            break;

        default:
            prompt = 'Wake up and do your job. Check state.json for your current status.';
    }

    prompt += '\n\nAfter submitting (any type), STOP and wait for response.';

    return prompt;
}

/**
 * Run Claude in the agent's directory
 */
function runClaude(agentSlug, prompt) {
    const agentDir = path.join(AGENTS_DIR, agentSlug);

    logStep('5', `Running Claude in ${agentDir}`);
    log(`Prompt: "${prompt.split('\n')[0]}..."`, 'dim');

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
 * @param {string} agentSlug - The agent to wake
 * @param {string} overrideWakeType - Optional wake type override from CLI (execution, continue_execution)
 * @param {string} overrideProposalId - Optional proposal ID for execution wakes
 */
async function wakeAgent(agentSlug, overrideWakeType = null, overrideProposalId = null) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`  SUITE Agent Wake v2: ${agentSlug}`, 'bright');
    if (overrideWakeType) {
        log(`  Wake Type Override: ${overrideWakeType}`, 'yellow');
    }
    log(`${'='.repeat(60)}\n`, 'cyan');

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
        log(`   Execution state: ${state.execution_state}`, 'dim');
        log(`   Total proposals: ${state.total_proposals}`, 'dim');
        if (state.current_task) {
            log(`   Current task: ${state.current_task.title}`, 'dim');
        }
    } catch (err) {
        logError(`Failed to load state: ${err.message}`);
        process.exit(1);
    }

    // Determine wake mode (may be overridden by CLI args)
    logStep('2', 'Determining wake mode...');
    let wakeMode;

    // If we have an override wake type, use it directly
    if (overrideWakeType === 'execution' && overrideProposalId) {
        // Fetch the approved proposal
        const proposal = await getProposal(overrideProposalId);
        if (proposal && proposal.status === 'passed') {
            wakeMode = {
                mode: 'start_execution',
                reason: 'cli_override_execution',
                proposal: proposal,
                feedback: proposal.agent_feedback || null
            };
            log('   Override: Starting execution from CLI', 'yellow');
        } else {
            wakeMode = await determineWakeMode(state);
        }
    } else if (overrideWakeType === 'continue_execution' && overrideProposalId) {
        // Continue execution after assistance
        const assistance = await checkForAssistance(overrideProposalId);
        if (assistance && state.current_task) {
            wakeMode = {
                mode: 'continue_execution',
                reason: 'cli_override_continue',
                assistance: assistance,
                task: state.current_task
            };
            log('   Override: Continuing execution from CLI', 'yellow');
        } else {
            wakeMode = await determineWakeMode(state);
        }
    } else {
        // Normal wake mode determination
        wakeMode = await determineWakeMode(state);
    }

    log(`   Mode: ${wakeMode.mode}`, 'green');
    log(`   Reason: ${wakeMode.reason}`, 'dim');

    // Handle modes that don't proceed
    if (wakeMode.mode === 'waiting') {
        log(`\n${colors.yellow}Agent cannot wake: ${wakeMode.reason}${colors.reset}`);
        log(`   ${wakeMode.message}`, 'dim');
        log('\nWaiting for human response on pending proposal.', 'yellow');
        process.exit(0);
    }

    if (wakeMode.mode === 'still_blocked') {
        log(`\n${colors.yellow}Agent still blocked: ${wakeMode.reason}${colors.reset}`);
        log(`   ${wakeMode.message}`, 'dim');
        log('\nWaiting for human to provide assistance.', 'yellow');
        process.exit(0);
    }

    // Update state based on mode
    logStep('3', 'Updating state...');
    state = updateStateForMode(state, wakeMode);
    state.last_wake = new Date().toISOString();
    saveAgentState(agentSlug, state);

    if (wakeMode.mode === 'start_execution') {
        logInfo('Approved proposal! Starting execution mode.');
    } else if (wakeMode.mode === 'continue_execution') {
        logInfo('Assistance received! Continuing execution.');
    } else if (wakeMode.reason === 'proposal_rejected') {
        logInfo('Proposal rejected. Learning from feedback.');
    }

    // Build and run prompt
    logStep('4', 'Building wake prompt...');
    const prompt = buildWakePrompt(wakeMode, state);

    // Run Claude
    runClaude(agentSlug, prompt);
}

// CLI Entry Point
const args = process.argv.slice(2);

// Parse command line args
function getArg(name) {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const wakeTypeArg = getArg('--wake-type');
const proposalIdArg = getArg('--proposal-id');

// Filter out option flags to get the agent slug
const positionalArgs = args.filter((arg, i) => {
    if (arg.startsWith('--')) return false;
    if (i > 0 && args[i - 1].startsWith('--')) return false;
    return true;
});

if (positionalArgs.length === 0) {
    log('\nSUITE Agent Wake Script v2 - Execution Mode', 'bright');
    log('\nUsage: node wake-agent.js <agent-slug> [options]', 'yellow');
    log('\nOptions:', 'dim');
    log('  --wake-type <type>      Wake type: proposal, execution, continue_execution', 'dim');
    log('  --proposal-id <id>      Associated proposal ID for execution wakes', 'dim');
    log('\nExample:', 'dim');
    log('  node wake-agent.js foodvitals-agent', 'dim');
    log('  node wake-agent.js foodvitals-agent --wake-type execution --proposal-id abc123', 'dim');
    log('\nAvailable agents:', 'dim');

    if (fs.existsSync(AGENTS_DIR)) {
        const agents = fs.readdirSync(AGENTS_DIR).filter(f =>
            fs.statSync(path.join(AGENTS_DIR, f)).isDirectory()
        );
        agents.forEach(a => log(`  - ${a}`, 'dim'));
    }

    log('\nv2 Features:', 'cyan');
    log('  - Execution mode: agents execute approved tasks', 'dim');
    log('  - Assistance requests: agents ask for help when blocked', 'dim');
    log('  - Pattern learning: agents learn from rejected proposals', 'dim');

    process.exit(1);
}

const agentSlug = positionalArgs[0];

// Check for required environment variables
if (!SUPABASE_ANON_KEY) {
    log('\nWarning: SUPABASE_ANON_KEY not set. Governance sync will not work.', 'yellow');
    log('Set it with: export SUPABASE_ANON_KEY=your-key\n', 'dim');
}

// Run with optional wake type override
wakeAgent(agentSlug, wakeTypeArg, proposalIdArg).catch(err => {
    logError(`Wake failed: ${err.message}`);
    process.exit(1);
});
