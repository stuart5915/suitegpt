const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const PORT = 3847;
const HTTP_PORT = 3846;

// Track connected clients
const clients = new Set();
let claudeProcess = null;

// Create HTTP server to serve the UI
const httpServer = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        // Serve the visualizer HTML
        const htmlPath = path.join(__dirname, 'index.html');
        fs.readFile(htmlPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading visualizer');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/start-stream') {
        // Start Claude Code stream
        startClaudeStream(res);
    } else if (req.url === '/stop-stream') {
        // Stop Claude Code stream
        stopClaudeStream(res);
    } else if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            streaming: claudeProcess !== null,
            clients: clients.size
        }));
    } else if (req.url === '/test') {
        // Send test events
        broadcast({ type: 'action', zone: 'read', label: 'Reading', detail: 'test.js', icon: '📖' });
        setTimeout(() => broadcast({ type: 'action', zone: 'search', label: 'Searching', detail: 'patterns', icon: '🔍' }), 800);
        setTimeout(() => broadcast({ type: 'action', zone: 'write', label: 'Writing', detail: 'output.js', icon: '✍️' }), 1600);
        setTimeout(() => broadcast({ type: 'action', zone: 'terminal', label: 'Running', detail: 'npm test', icon: '💻' }), 2400);
        setTimeout(() => broadcast({ type: 'spawn', zone: 'agents', label: 'Spawning', detail: 'sub-agent', icon: '🤖' }), 3200);
        setTimeout(() => broadcast({ type: 'complete', zone: 'center', label: 'Done' }), 4000);
        res.writeHead(200);
        res.end('Test events sent!');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// WebSocket server
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`✅ UI connected (${clients.size} clients)`);

    // Send current status
    ws.send(JSON.stringify({
        type: 'status',
        streaming: claudeProcess !== null,
        clients: clients.size
    }));

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`❌ UI disconnected (${clients.size} clients)`);
    });

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.action === 'start') {
                startClaudeStreamWS();
            } else if (data.action === 'stop') {
                stopClaudeStream();
            } else if (data.action === 'test') {
                // Trigger test from UI
                broadcast({ type: 'action', zone: 'read', label: 'Reading', detail: 'test.js', icon: '📖' });
                setTimeout(() => broadcast({ type: 'action', zone: 'write', label: 'Writing', detail: 'output.js', icon: '✍️' }), 1000);
                setTimeout(() => broadcast({ type: 'spawn', zone: 'agents', label: 'Spawning', detail: 'sub-agent', icon: '🤖' }), 2000);
                setTimeout(() => broadcast({ type: 'complete', zone: 'center', label: 'Done' }), 3000);
            }
        } catch (e) {}
    });
});

// Broadcast to all clients
function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Start Claude Code stream
function startClaudeStreamWS() {
    if (claudeProcess) {
        broadcast({ type: 'error', label: 'Already streaming' });
        return;
    }

    console.log('🚀 Starting Claude Code stream...');
    broadcast({ type: 'status', streaming: true, message: 'Starting stream...' });

    // For now, we'll simulate - the real integration would spawn claude
    // The user can also pipe manually: claude ... | node server.js
    broadcast({ type: 'info', label: 'Stream Ready', detail: 'Listening for Claude Code activity...' });
}

function startClaudeStream(res) {
    startClaudeStreamWS();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Stream started' }));
}

function stopClaudeStream(res) {
    if (claudeProcess) {
        claudeProcess.kill();
        claudeProcess = null;
    }
    broadcast({ type: 'status', streaming: false, message: 'Stream stopped' });
    console.log('⏹️ Stream stopped');

    if (res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Stream stopped' }));
    }
}

// Read from stdin (for piped input from Claude Code)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    try {
        const event = JSON.parse(line);
        const visualEvent = parseClaudeEvent(event);
        if (visualEvent) {
            broadcast(visualEvent);
        }
    } catch (e) {
        // Not JSON, might be regular output
    }
});

// Parse Claude Code events into visualization events
function parseClaudeEvent(event) {
    const type = event.type;

    if (type === 'assistant') {
        if (event.message?.content) {
            const content = event.message.content;
            for (const block of content) {
                if (block.type === 'tool_use') {
                    return parseToolUse(block);
                }
                if (block.type === 'text') {
                    return {
                        type: 'thinking',
                        zone: 'center',
                        label: 'Thinking...',
                        detail: block.text?.substring(0, 50) + '...'
                    };
                }
            }
        }
    }

    if (type === 'tool_result' || type === 'result') {
        return {
            type: 'complete',
            zone: 'center',
            label: 'Task complete'
        };
    }

    if (type === 'error') {
        return {
            type: 'error',
            zone: 'center',
            label: 'Error',
            detail: event.error?.message || 'Unknown error'
        };
    }

    return null;
}

// Parse tool use into visual events
function parseToolUse(block) {
    const tool = block.name;
    const input = block.input || {};

    switch (tool) {
        case 'Read':
            return {
                type: 'action',
                zone: 'read',
                label: 'Reading',
                detail: input.file_path?.split(/[/\\]/).pop() || 'file',
                icon: '📖'
            };

        case 'Write':
            return {
                type: 'action',
                zone: 'write',
                label: 'Writing',
                detail: input.file_path?.split(/[/\\]/).pop() || 'file',
                icon: '✍️'
            };

        case 'Edit':
            return {
                type: 'action',
                zone: 'write',
                label: 'Editing',
                detail: input.file_path?.split(/[/\\]/).pop() || 'file',
                icon: '🔧'
            };

        case 'Bash':
            return {
                type: 'action',
                zone: 'terminal',
                label: 'Terminal',
                detail: input.command?.substring(0, 30) || 'command',
                icon: '💻'
            };

        case 'Glob':
        case 'Grep':
            return {
                type: 'action',
                zone: 'search',
                label: 'Searching',
                detail: input.pattern || 'files',
                icon: '🔍'
            };

        case 'Task':
            return {
                type: 'spawn',
                zone: 'agents',
                label: 'Spawning Agent',
                detail: input.description || 'sub-task',
                icon: '🤖'
            };

        case 'WebSearch':
        case 'WebFetch':
            return {
                type: 'action',
                zone: 'web',
                label: 'Web',
                detail: input.query || input.url || 'fetching',
                icon: '🌐'
            };

        default:
            return {
                type: 'action',
                zone: 'center',
                label: tool,
                detail: 'working...',
                icon: '⚡'
            };
    }
}

// Start servers
httpServer.listen(HTTP_PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║           🚀 SUITE AI FLEET VISUALIZER 🚀              ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Open in browser:  http://localhost:${HTTP_PORT}              ║
║                                                        ║
║  WebSocket:        ws://localhost:${PORT}               ║
║                                                        ║
║  Test events:      http://localhost:${HTTP_PORT}/test         ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

To connect Claude Code, run:
  claude -p "prompt" --output-format stream-json | node server.js

Or just open the browser and click "Start Stream" to begin!
`);
});
