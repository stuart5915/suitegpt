const WebSocket = require('ws');
const readline = require('readline');

const PORT = 3847;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Fleet Visualizer server running on ws://localhost:${PORT}`);
console.log(`📡 Waiting for Claude Code stream...`);
console.log(`\nUsage: claude -p "prompt" --output-format stream-json | node server.js\n`);

// Track connected clients
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`✅ UI connected (${clients.size} clients)`);

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', agents: 1 }));

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`❌ UI disconnected (${clients.size} clients)`);
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

// Read from stdin (Claude Code's stream-json output)
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
    // Handle different event types from Claude Code
    const type = event.type;

    if (type === 'assistant') {
        // Claude is thinking/responding
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
                detail: input.file_path?.split('/').pop() || 'file',
                icon: '📖'
            };

        case 'Write':
            return {
                type: 'action',
                zone: 'write',
                label: 'Writing',
                detail: input.file_path?.split('/').pop() || 'file',
                icon: '✍️'
            };

        case 'Edit':
            return {
                type: 'action',
                zone: 'write',
                label: 'Editing',
                detail: input.file_path?.split('/').pop() || 'file',
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

// Also allow manual testing via HTTP
const http = require('http');
const server = http.createServer((req, res) => {
    if (req.url === '/test') {
        // Send test events
        broadcast({ type: 'action', zone: 'read', label: 'Reading', detail: 'test.js', icon: '📖' });
        setTimeout(() => broadcast({ type: 'action', zone: 'write', label: 'Writing', detail: 'output.js', icon: '✍️' }), 1000);
        setTimeout(() => broadcast({ type: 'spawn', zone: 'agents', label: 'Spawning', detail: 'sub-agent', icon: '🤖' }), 2000);
        setTimeout(() => broadcast({ type: 'complete', zone: 'center', label: 'Done' }), 3000);
        res.end('Test events sent!');
    } else {
        res.end('Fleet Visualizer Server\n\nGET /test - Send test events');
    }
});

server.listen(3848, () => {
    console.log(`🧪 Test server on http://localhost:3848/test`);
});
