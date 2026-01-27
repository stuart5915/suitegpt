# Suite AI Fleet Visualizer

Real-time Factorio-style visualization of AI agents working in Claude Code.

![Fleet Visualizer](preview.png)

## Quick Start

### 1. Install dependencies
```bash
cd fleet-visualizer
npm install
```

### 2. Start the server
```bash
npm start
```

### 3. Open the UI
Open `index.html` in your browser (or use as OBS browser source)

### 4. Connect Claude Code
Run Claude Code with stream-json output piped to the server:
```bash
claude -p "your prompt" --output-format stream-json | node server.js
```

Or for interactive mode, use a named pipe or run in separate terminals.

## For OBS Streaming

1. Add a **Browser Source** in OBS
2. Set URL to: `file:///path/to/fleet-visualizer/index.html`
3. Set width: 800, height: 800
4. Check "Shutdown source when not visible"

## Testing

Visit `http://localhost:3848/test` to send test events and see the visualization in action.

## How It Works

```
Claude Code Terminal
    ↓ (--output-format stream-json)
WebSocket Server (port 3847)
    ↓ (broadcasts events)
Web UI (index.html)
    ↓
OBS Browser Source
```

## Zones

- 📖 **Read** - Reading files from codebase
- ✍️ **Write** - Writing/editing files
- 🔍 **Search** - Glob/Grep searches
- 💻 **Terminal** - Bash commands
- 🌐 **Web** - Web searches/fetches
- 🤖 **Agents** - Spawning sub-agents (Task tool)

## Customization

Edit `index.html` to customize:
- Colors (CSS variables)
- Zone positions
- Animation speeds
- Logo/branding
