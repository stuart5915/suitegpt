/**
 * Fleet Streamer - Watches Claude Code activity and broadcasts to Supabase
 * Supports multiple agents/sessions tracked by project folder
 * Double-click "Start Fleet Streamer.bat" to run
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase config
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';
const CHANNEL_NAME = 'fleet-stream';

// Claude Code transcript directory
const CLAUDE_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude');

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let channel = null;

// Track agents by their session file
const agents = new Map(); // filePath -> { id, project, startTime, lastAction, status }

console.log(`
╔════════════════════════════════════════════════════════╗
║         🚀 SUITE FLEET STREAMER v2.0 🚀                ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Watching for Claude Code activity...                  ║
║  Events will stream to suitegpt.app/governance/stream  ║
║                                                        ║
║  Now supporting MULTIPLE AGENTS!                       ║
║  Each project folder = separate agent card             ║
║                                                        ║
║  Keep this window open while streaming.                ║
║  Press Ctrl+C to stop.                                 ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);

// Track last sent time to avoid spam
let lastSent = 0;
const MIN_INTERVAL = 150; // ms between events

// Generate short unique ID
function generateId() {
    return Math.random().toString(36).substring(2, 8);
}

// Extract project name from file path
function extractProject(filePath) {
    // File path looks like: .claude/projects/C--Users-info-Documents-PROJECT-NAME/session.jsonl
    // Or from tool use: C:\Users\info\Documents\PROJECT-NAME\file.js

    if (!filePath) return 'unknown';

    // Try to extract from .claude/projects path
    const projectMatch = filePath.match(/projects[/\\]C--[^/\\]+-([^/\\]+)/);
    if (projectMatch) {
        return projectMatch[1].replace(/-/g, ' ').substring(0, 20);
    }

    // Try to extract from regular file path (Documents/PROJECT/...)
    const docMatch = filePath.match(/Documents[/\\]([^/\\]+)/i);
    if (docMatch) {
        return docMatch[1].substring(0, 20);
    }

    // Fallback: use parent folder name
    const parts = filePath.split(/[/\\]/);
    if (parts.length >= 2) {
        return parts[parts.length - 2].substring(0, 20);
    }

    return 'project';
}

// Get or create agent for a session file
function getAgent(sessionFilePath) {
    if (!agents.has(sessionFilePath)) {
        const project = extractProject(sessionFilePath);
        agents.set(sessionFilePath, {
            id: generateId(),
            project: project,
            startTime: Date.now(),
            lastActivity: Date.now(),
            status: 'active',
            currentAction: null
        });
        console.log(`🆕 New agent detected: ${project} (${agents.get(sessionFilePath).id})`);
    }

    const agent = agents.get(sessionFilePath);
    agent.lastActivity = Date.now();
    agent.status = 'active';
    return agent;
}

// Initialize channel and start broadcasting
async function initChannel() {
    channel = supabase.channel(CHANNEL_NAME);

    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('✅ Connected to Supabase Realtime channel');

            // Send initial online event
            broadcastEvent({
                type: 'streamer_online',
                label: 'Fleet Streamer Online',
                icon: '🚀',
                detail: 'Watching for activity...',
                timestamp: Date.now()
            });
        } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Failed to connect to channel');
        }
    });
}

// Broadcast event to Supabase
async function broadcastEvent(event) {
    const now = Date.now();
    if (now - lastSent < MIN_INTERVAL) return;
    lastSent = now;

    if (!channel) {
        console.log('⏳ Channel not ready, skipping event');
        return;
    }

    try {
        const result = await channel.send({
            type: 'broadcast',
            event: 'fleet-event',
            payload: {
                ...event,
                timestamp: Date.now()
            }
        });

        if (result === 'ok') {
            const agentInfo = event.agentId ? `[${event.project}]` : '[system]';
            console.log(`📡 ${agentInfo} ${event.action || event.label}: ${event.detail || ''}`);
        } else {
            console.log(`❌ Failed to send (${result})`);
        }
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
    }
}

// Parse Claude Code events with agent tracking
function parseClaudeEvent(event, sessionFilePath) {
    const type = event.type;
    const agent = getAgent(sessionFilePath);

    if (type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
            if (block.type === 'tool_use') {
                return parseToolUse(block, agent, sessionFilePath);
            }
            if (block.type === 'text' && block.text) {
                // Don't expose actual thinking - just show "Thinking..."
                return {
                    type: 'thinking',
                    agentId: agent.id,
                    project: agent.project,
                    sessionStart: agent.startTime,
                    action: 'Thinking',
                    icon: '💭',
                    detail: 'Processing...',
                    status: 'active'
                };
            }
        }
    }

    if (type === 'result') {
        agent.currentAction = null;
        return {
            type: 'complete',
            agentId: agent.id,
            project: agent.project,
            sessionStart: agent.startTime,
            action: 'Complete',
            icon: '✅',
            detail: 'Task finished',
            status: 'idle'
        };
    }

    return null;
}

function parseToolUse(block, agent, sessionFilePath) {
    const tool = block.name;
    const input = block.input || {};

    // Extract project from file path in the tool input (more accurate)
    let project = agent.project;
    const filePath = input.file_path || input.path || '';
    if (filePath) {
        const extractedProject = extractProject(filePath);
        if (extractedProject !== 'unknown' && extractedProject !== 'project') {
            project = extractedProject;
            // Update agent's project if we found a better name
            agent.project = project;
        }
    }

    // Safe descriptions - don't expose sensitive details
    const toolMap = {
        'Read': {
            action: 'Reading',
            icon: '📖',
            detail: safeFileName(input.file_path)
        },
        'Write': {
            action: 'Writing',
            icon: '✍️',
            detail: safeFileName(input.file_path)
        },
        'Edit': {
            action: 'Editing',
            icon: '🔧',
            detail: safeFileName(input.file_path)
        },
        'Bash': {
            action: 'Terminal',
            icon: '💻',
            detail: safeBashCommand(input.command)
        },
        'Glob': {
            action: 'Finding files',
            icon: '🔍',
            detail: input.pattern ? `*${path.extname(input.pattern) || '.*'}` : 'searching...'
        },
        'Grep': {
            action: 'Searching code',
            icon: '🔍',
            detail: 'pattern match'
        },
        'Task': {
            action: 'Sub-agent',
            icon: '🤖',
            detail: input.description?.substring(0, 30) || 'spawning...'
        },
        'WebSearch': {
            action: 'Web search',
            icon: '🌐',
            detail: 'researching...'
        },
        'WebFetch': {
            action: 'Fetching web',
            icon: '🌐',
            detail: safeDomain(input.url)
        }
    };

    const mapped = toolMap[tool] || { action: tool, icon: '⚡', detail: 'working...' };

    agent.currentAction = mapped.action;

    return {
        type: 'action',
        agentId: agent.id,
        project: project,
        sessionStart: agent.startTime,
        action: mapped.action,
        icon: mapped.icon,
        detail: mapped.detail,
        status: 'active'
    };
}

// Safe extraction functions - don't expose sensitive info
function safeFileName(filePath) {
    if (!filePath) return 'file';
    const name = path.basename(filePath);
    // Hide potentially sensitive file names
    if (name.includes('env') || name.includes('secret') || name.includes('key') || name.includes('credential')) {
        return 'config file';
    }
    return name.substring(0, 25);
}

function safeBashCommand(cmd) {
    if (!cmd) return 'running command';
    // Don't expose actual commands - just categorize them
    if (cmd.startsWith('git')) return 'git operation';
    if (cmd.startsWith('npm') || cmd.startsWith('yarn') || cmd.startsWith('pnpm')) return 'package manager';
    if (cmd.startsWith('node')) return 'running node';
    if (cmd.startsWith('python')) return 'running python';
    if (cmd.includes('test')) return 'running tests';
    if (cmd.includes('build')) return 'building';
    if (cmd.includes('install')) return 'installing';
    return 'terminal command';
}

function safeDomain(url) {
    if (!url) return 'webpage';
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '').substring(0, 20);
    } catch {
        return 'webpage';
    }
}

// Watch for new JSONL files and tail them
const watchedFiles = new Set();
const filePositions = new Map();

function watchDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    // Watch for new files
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.jsonl')) {
            const fullPath = path.join(dir, filename);
            watchFile(fullPath);
        }
    });

    // Watch existing files
    findJsonlFiles(dir).forEach(watchFile);
}

function findJsonlFiles(dir) {
    const files = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...findJsonlFiles(fullPath));
            } else if (entry.name.endsWith('.jsonl')) {
                files.push(fullPath);
            }
        }
    } catch (e) {}
    return files;
}

function watchFile(filePath) {
    if (watchedFiles.has(filePath)) return;
    if (!fs.existsSync(filePath)) return;

    watchedFiles.add(filePath);

    // Start at end of file
    const stats = fs.statSync(filePath);
    filePositions.set(filePath, stats.size);

    const project = extractProject(filePath);
    console.log(`👁️ Watching: ${path.basename(filePath)} (${project})`);

    // Watch for changes
    fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            readNewLines(filePath);
        }
    });
}

function readNewLines(filePath) {
    const lastPos = filePositions.get(filePath) || 0;
    let stats;
    try {
        stats = fs.statSync(filePath);
    } catch (e) {
        return;
    }

    if (stats.size <= lastPos) return;

    const stream = fs.createReadStream(filePath, {
        start: lastPos,
        end: stats.size
    });

    let buffer = '';
    stream.on('data', (chunk) => {
        buffer += chunk.toString();
    });

    stream.on('end', () => {
        filePositions.set(filePath, stats.size);

        const lines = buffer.split('\n').filter(l => l.trim());
        for (const line of lines) {
            try {
                const event = JSON.parse(line);
                const visualEvent = parseClaudeEvent(event, filePath);
                if (visualEvent) {
                    broadcastEvent(visualEvent);
                }
            } catch (e) {}
        }
    });
}

// Check for idle agents periodically
function checkIdleAgents() {
    const now = Date.now();
    const IDLE_THRESHOLD = 30000; // 30 seconds

    for (const [filePath, agent] of agents) {
        if (agent.status === 'active' && now - agent.lastActivity > IDLE_THRESHOLD) {
            agent.status = 'idle';
            broadcastEvent({
                type: 'status_change',
                agentId: agent.id,
                project: agent.project,
                sessionStart: agent.startTime,
                action: 'Idle',
                icon: '💤',
                detail: 'Waiting...',
                status: 'idle'
            });
        }
    }
}

// Send fleet summary periodically
function sendFleetSummary() {
    const activeAgents = Array.from(agents.values()).filter(a => a.status === 'active');
    const idleAgents = Array.from(agents.values()).filter(a => a.status === 'idle');

    broadcastEvent({
        type: 'fleet_summary',
        activeCount: activeAgents.length,
        idleCount: idleAgents.length,
        totalCount: agents.size,
        agents: Array.from(agents.values()).map(a => ({
            id: a.id,
            project: a.project,
            status: a.status,
            sessionStart: a.startTime,
            lastActivity: a.lastActivity
        }))
    });
}

// Start
initChannel().then(() => {
    // Start watching
    watchDirectory(CLAUDE_DIR);

    // Re-scan for new files every 5 seconds (Windows fs.watch can miss new files)
    setInterval(() => {
        findJsonlFiles(CLAUDE_DIR).forEach(watchFile);
    }, 5000);

    // Check for idle agents every 10 seconds
    setInterval(checkIdleAgents, 10000);

    // Send fleet summary every 30 seconds
    setInterval(sendFleetSummary, 30000);

    console.log('✅ Streamer ready! Use Claude Code normally.\n');
});
