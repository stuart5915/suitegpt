#!/usr/bin/env node

/**
 * Claude Watcher Script
 *
 * Polls Supabase for pending claude_tasks and executes them using Claude CLI.
 * Run this script on your PC to process tasks from Stuart Factory.
 *
 * Usage: node scripts/claude-watcher.js
 */

const { execSync, spawn } = require('child_process');
const https = require('https');

// Supabase config
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

// Working directory for Claude
const WORKING_DIR = 'C:\\Users\\info\\Documents\\stuart-hollinger-landing\\stuart-hollinger-landing';

// Poll interval in milliseconds
const POLL_INTERVAL = 5000;

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Make HTTP request to Supabase
function supabaseRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : null);
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// Get pending tasks
async function getPendingTasks() {
    const tasks = await supabaseRequest(
        'GET',
        '/rest/v1/claude_tasks?status=eq.pending&order=created_at.asc&limit=1'
    );
    return tasks || [];
}

// Update task status
async function updateTask(taskId, updates) {
    await supabaseRequest(
        'PATCH',
        `/rest/v1/claude_tasks?id=eq.${taskId}`,
        updates
    );
}

// Execute Claude with prompt
async function executeClaudePrompt(prompt) {
    return new Promise((resolve, reject) => {
        log('Executing Claude...', 'cyan');

        // Use claude CLI with print mode for non-interactive execution
        const claude = spawn('claude', ['-p', prompt, '--output-format', 'text'], {
            cwd: WORKING_DIR,
            shell: true,
            env: { ...process.env }
        });

        let stdout = '';
        let stderr = '';

        claude.stdout.on('data', (data) => {
            stdout += data.toString();
            process.stdout.write(data);
        });

        claude.stderr.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });

        claude.on('close', (code) => {
            if (code === 0) {
                resolve(stdout || 'Task completed successfully.');
            } else {
                reject(new Error(stderr || `Claude exited with code ${code}`));
            }
        });

        claude.on('error', (err) => {
            reject(err);
        });
    });
}

// Process a single task
async function processTask(task) {
    log(`Processing task: ${task.id}`, 'blue');
    log(`Target: ${task.target}`, 'blue');
    log(`Prompt: ${task.prompt.substring(0, 100)}...`, 'blue');

    try {
        // Mark as processing
        await updateTask(task.id, { status: 'processing' });

        // Execute Claude
        const response = await executeClaudePrompt(task.prompt);

        // Mark as completed
        await updateTask(task.id, {
            status: 'completed',
            response: response,
            completed_at: new Date().toISOString()
        });

        log('Task completed successfully!', 'green');

    } catch (error) {
        log(`Task failed: ${error.message}`, 'red');

        await updateTask(task.id, {
            status: 'error',
            error_message: error.message,
            completed_at: new Date().toISOString()
        });
    }
}

// Main polling loop
async function main() {
    console.log('');
    log('='.repeat(50), 'bright');
    log('  Claude Watcher Started', 'bright');
    log('='.repeat(50), 'bright');
    log(`Working directory: ${WORKING_DIR}`, 'cyan');
    log(`Poll interval: ${POLL_INTERVAL / 1000}s`, 'cyan');
    log('Waiting for tasks...', 'yellow');
    console.log('');

    // Check if Claude CLI is available
    try {
        execSync('claude --version', { stdio: 'pipe' });
        log('Claude CLI found', 'green');
    } catch (e) {
        log('ERROR: Claude CLI not found. Make sure "claude" is in your PATH.', 'red');
        process.exit(1);
    }

    while (true) {
        try {
            const tasks = await getPendingTasks();

            if (tasks.length > 0) {
                await processTask(tasks[0]);
            }
        } catch (error) {
            log(`Poll error: ${error.message}`, 'red');
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
}

// Handle shutdown
process.on('SIGINT', () => {
    log('\nShutting down...', 'yellow');
    process.exit(0);
});

// Run
main().catch(err => {
    log(`Fatal error: ${err.message}`, 'red');
    process.exit(1);
});
