/**
 * Fleet Streamer - Watches Claude Code activity and broadcasts to Supabase
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

console.log(`
╔════════════════════════════════════════════════════════╗
║         🚀 SUITE FLEET STREAMER - Running 🚀           ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Watching for Claude Code activity...                  ║
║  Events will stream to suitegpt.app/governance/stream  ║
║                                                        ║
║  Keep this window open while streaming.                ║
║  Press Ctrl+C to stop.                                 ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);

// Track last sent time to avoid spam
let lastSent = 0;
const MIN_INTERVAL = 200; // ms between events

// Initialize channel and start broadcasting
async function initChannel() {
    channel = supabase.channel(CHANNEL_NAME);

    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('✅ Connected to Supabase Realtime channel');

            // Send initial online event
            broadcastEvent({
                type: 'status',
                zone: 'center',
                label: 'Fleet Streamer Online',
                icon: '🚀',
                detail: 'Watching for activity...'
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
            payload: event
        });

        if (result === 'ok') {
            console.log(`📡 Sent: ${event.label} - ${event.detail || ''}`);
        } else {
            console.log(`❌ Failed to send: ${event.label} (${result})`);
        }
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
    }
}

// Parse Claude Code events
function parseClaudeEvent(event) {
    const type = event.type;

    if (type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
            if (block.type === 'tool_use') {
                return parseToolUse(block);
            }
            if (block.type === 'text' && block.text) {
                return {
                    type: 'thinking',
                    zone: 'center',
                    label: 'Thinking',
                    detail: block.text.substring(0, 60).replace(/\n/g, ' ') + '...',
                    icon: '🧠'
                };
            }
        }
    }

    if (type === 'result') {
        return {
            type: 'complete',
            zone: 'center',
            label: 'Complete',
            icon: '✅'
        };
    }

    return null;
}

function parseToolUse(block) {
    const tool = block.name;
    const input = block.input || {};

    const toolMap = {
        'Read': { zone: 'read', label: 'Reading', icon: '📖', detail: input.file_path?.split(/[/\\]/).pop() },
        'Write': { zone: 'write', label: 'Writing', icon: '✍️', detail: input.file_path?.split(/[/\\]/).pop() },
        'Edit': { zone: 'write', label: 'Editing', icon: '🔧', detail: input.file_path?.split(/[/\\]/).pop() },
        'Bash': { zone: 'terminal', label: 'Terminal', icon: '💻', detail: input.command?.substring(0, 40) },
        'Glob': { zone: 'search', label: 'Searching', icon: '🔍', detail: input.pattern },
        'Grep': { zone: 'search', label: 'Searching', icon: '🔍', detail: input.pattern },
        'Task': { zone: 'agents', label: 'Spawning Agent', icon: '🤖', detail: input.description },
        'WebSearch': { zone: 'web', label: 'Web Search', icon: '🌐', detail: input.query },
        'WebFetch': { zone: 'web', label: 'Fetching', icon: '🌐', detail: input.url?.substring(0, 40) }
    };

    const mapped = toolMap[tool] || { zone: 'center', label: tool, icon: '⚡', detail: 'working...' };
    return { type: 'action', ...mapped };
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

    console.log(`👁️ Watching: ${path.basename(filePath)}`);

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
                const visualEvent = parseClaudeEvent(event);
                if (visualEvent) {
                    broadcastEvent(visualEvent);
                }
            } catch (e) {}
        }
    });
}

// Also read from stdin if piped
if (!process.stdin.isTTY) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin });

    rl.on('line', (line) => {
        try {
            const event = JSON.parse(line);
            const visualEvent = parseClaudeEvent(event);
            if (visualEvent) {
                broadcastEvent(visualEvent);
            }
        } catch (e) {}
    });

    console.log('📥 Reading from stdin...');
}

// Start
initChannel().then(() => {
    // Start watching
    watchDirectory(CLAUDE_DIR);

    // Re-scan for new files every 5 seconds (Windows fs.watch can miss new files)
    setInterval(() => {
        findJsonlFiles(CLAUDE_DIR).forEach(watchFile);
    }, 5000);

    // Send heartbeat every 30s to show streamer is alive
    setInterval(() => {
        broadcastEvent({
            type: 'heartbeat',
            zone: 'center',
            label: 'Fleet Online',
            icon: '💚',
            detail: new Date().toLocaleTimeString()
        });
    }, 30000);

    console.log('✅ Streamer ready! Use Claude Code normally.\n');
});
