#!/usr/bin/env node
/**
 * Agent Wake Daemon
 *
 * Polls Supabase for pending wake requests and executes them.
 * Run this locally to enable the "Wake Agent" button in the dashboard.
 *
 * Usage:
 *   node scripts/wake-daemon.js
 *
 * Options:
 *   --interval <ms>   Polling interval in milliseconds (default: 5000)
 *   --once            Process one request and exit
 *   --agent <slug>    Only process requests for a specific agent
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line args
const args = process.argv.slice(2);
const pollInterval = args.includes('--interval')
    ? parseInt(args[args.indexOf('--interval') + 1]) || 5000
    : 5000;
const runOnce = args.includes('--once');
const specificAgent = args.includes('--agent')
    ? args[args.indexOf('--agent') + 1]
    : null;

// Supabase config - same as factory.html
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_KEY environment variable is required');
    console.error('Set it with: export SUPABASE_SERVICE_KEY=your-service-key');
    process.exit(1);
}

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    dim: '\x1b[2m',
};

function log(msg, color = '') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${msg}${colors.reset}`);
}

// Get hostname for heartbeat
const hostname = require('os').hostname();

// Send heartbeat to Supabase
async function sendHeartbeat() {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_daemon_heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({ p_hostname: hostname }),
        });
    } catch (err) {
        // Silent fail for heartbeat
    }
}

// Claim a pending wake request
async function claimRequest() {
    try {
        const body = specificAgent
            ? { p_agent_slug: specificAgent }
            : {};

        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_wake_request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Claim failed: ${response.status} - ${text}`);
        }

        const data = await response.json();

        // RPC returns array, get first result
        if (Array.isArray(data) && data.length > 0) {
            return data[0];
        }
        return null;
    } catch (err) {
        log(`Error claiming request: ${err.message}`, colors.red);
        return null;
    }
}

// Complete a wake request
async function completeRequest(requestId, proposalId = null, errorMessage = null) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/complete_wake_request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
                p_request_id: requestId,
                p_proposal_id: proposalId,
                p_error_message: errorMessage,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            log(`Failed to complete request: ${text}`, colors.red);
        }
    } catch (err) {
        log(`Error completing request: ${err.message}`, colors.red);
    }
}

// Run the wake-agent.js script
function runWakeAgent(agentSlug) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'wake-agent.js');

        log(`Spawning: node ${scriptPath} ${agentSlug}`, colors.blue);

        const child = spawn('node', [scriptPath, agentSlug], {
            cwd: path.join(__dirname, '..'),
            stdio: ['inherit', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            // Stream output in real-time
            process.stdout.write(colors.dim + text + colors.reset);
        });

        child.stderr.on('data', (data) => {
            const text = data.toString();
            stderr += text;
            process.stderr.write(colors.yellow + text + colors.reset);
        });

        child.on('close', (code) => {
            if (code === 0) {
                // Try to extract proposal ID from output
                const proposalMatch = stdout.match(/proposal[_-]?id[:\s]+([a-f0-9-]+)/i);
                const proposalId = proposalMatch ? proposalMatch[1] : null;
                resolve({ success: true, proposalId, output: stdout });
            } else {
                reject(new Error(`Wake script exited with code ${code}: ${stderr || stdout}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

// Process a single wake request
async function processRequest(request) {
    const { request_id, agent_slug, requested_at } = request;
    const age = Math.round((Date.now() - new Date(requested_at).getTime()) / 1000);

    log(`Processing wake request for ${agent_slug} (queued ${age}s ago)`, colors.green);

    try {
        const result = await runWakeAgent(agent_slug);

        log(`Wake completed successfully for ${agent_slug}`, colors.green);
        if (result.proposalId) {
            log(`Proposal ID: ${result.proposalId}`, colors.blue);
        }

        await completeRequest(request_id, result.proposalId, null);

    } catch (err) {
        log(`Wake failed for ${agent_slug}: ${err.message}`, colors.red);
        await completeRequest(request_id, null, err.message);
    }
}

// Main polling loop
async function pollLoop() {
    // Send heartbeat
    await sendHeartbeat();

    log('Checking for pending wake requests...', colors.dim);

    const request = await claimRequest();

    if (request) {
        await processRequest(request);
    }

    if (!runOnce) {
        setTimeout(pollLoop, pollInterval);
    } else if (!request) {
        log('No pending requests. Exiting.', colors.dim);
    }
}

// Startup
console.log('');
console.log(`${colors.bright}=== Agent Wake Daemon ===${colors.reset}`);
console.log(`${colors.dim}Polling interval: ${pollInterval}ms${colors.reset}`);
if (specificAgent) {
    console.log(`${colors.dim}Filtering for agent: ${specificAgent}${colors.reset}`);
}
if (runOnce) {
    console.log(`${colors.dim}Mode: Process once and exit${colors.reset}`);
}
console.log(`${colors.dim}Supabase: ${SUPABASE_URL}${colors.reset}`);
console.log('');

// Start polling
pollLoop();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down daemon...');
    process.exit(0);
});
