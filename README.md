# SUITE - AI-Native App Ecosystem

A production AI platform featuring 29+ apps, real-time multi-agent visualization, and LLM-powered development tools. Built with Claude, deployed on Vercel.

**Live:** [suitegpt.app](https://suitegpt.app) | [getsuite.app](https://getsuite.app)

---

## What I Built

SUITE is an ecosystem where AI agents build apps that generate yield for users. The platform demonstrates:

- **Multi-agent orchestration** - Real-time visualization of multiple Claude Code sessions working in parallel
- **LLM-native interfaces** - Chat-based app creation, AI-powered search, context-aware suggestions
- **Production AI infrastructure** - Cross-domain auth, real-time streaming, token systems

### Key Technical Achievements

| Feature | Implementation |
|---------|----------------|
| **Fleet Stream** | Real-time visualization of AI agents working across multiple projects. Node.js watcher tails Claude Code transcripts, broadcasts via Supabase Realtime to web clients |
| **SuiteGPT** | AI assistant with Gemini integration, chat history persistence, context-aware app recommendations, markdown rendering |
| **Cross-Domain Auth** | Supabase session tokens passed via URL params to iframe-embedded apps, enabling SSO across different domains |
| **App Factory** | Governance system where users propose, vote (quadratic voting), and fund new apps to be built |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUITE Platform                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   SuiteGPT   │  │  App Factory │  │ Fleet Stream │          │
│  │  (Gemini AI) │  │ (Governance) │  │  (Realtime)  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│                    ┌──────▼───────┐                            │
│                    │   Supabase   │                            │
│                    │  (Postgres + │                            │
│                    │   Realtime)  │                            │
│                    └──────────────┘                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  29+ Apps: Health, Finance, Productivity, AI Tools              │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │
│  │Hydro│ │Focus│ │Meal │ │Quick│ │Cadnc│ │ ... │              │
│  │Track│ │Flow │ │Prep │ │Budgt│ │ AI  │ │     │              │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fleet Stream - Multi-Agent Visualization

Real-time system that watches multiple Claude Code sessions and broadcasts their activity to a web dashboard.

**How it works:**

1. **Fleet Streamer** (Node.js) watches `~/.claude/` for JSONL transcript files
2. Parses tool usage events (Read, Write, Edit, Bash, Task, etc.)
3. Extracts project name from file paths, generates safe descriptions (no sensitive data)
4. Broadcasts via Supabase Realtime channels
5. **Web client** receives events, renders agent cards with live status

```javascript
// Agent event structure
{
  agentId: "abc123",
  project: "suitegpt",
  action: "Editing",
  icon: "🔧",
  detail: "suitegpt.html",
  status: "active",
  sessionStart: 1706380800000
}
```

**Features:**
- Multiple agents displayed as cards
- Per-agent session timers
- Active/idle status detection
- Color-coded by project
- Unified activity stream

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS, HTML/CSS (no framework - fast) |
| **Backend** | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| **AI** | Claude (development), Gemini (chat features) |
| **Hosting** | Vercel (auto-deploy on push) |
| **Payments** | Stripe (planned), Crypto (Solana) |
| **Real-time** | Supabase Realtime (WebSocket channels) |

---

## Project Structure

```
├── suitegpt.html          # Main AI chat interface (~900KB, single-file app)
├── fleet-visualizer/      # Multi-agent streaming system
│   └── fleet-streamer.js  # Node.js watcher + broadcaster
├── api/                   # Vercel serverless functions
├── docs/                  # Documentation site
├── learn/                 # Educational articles
├── contracts/             # Solana smart contracts
├── apps-subpages/         # Individual app landing pages
└── [29 app HTML files]    # Standalone PWA apps
```

---

## Development Approach

This project is built **with** AI, not just **about** AI:

- **Claude Code** for all development (this README was written with Claude)
- **Multi-session workflow** - 3+ Claude instances working on different features simultaneously
- **Fleet Stream** lets me watch all agents in real-time
- **Rapid iteration** - Deploy on every push, fix in production

Average commit frequency: **10-20 commits/day** during active development.

---

## Running Locally

```bash
# Clone
git clone https://github.com/stuart5915/suitegpt.git
cd suitegpt

# Start Fleet Streamer (optional - for agent visualization)
cd fleet-visualizer
npm install
npm run stream

# Serve files (any static server works)
npx serve .
```

The app uses Supabase for backend - you'll need your own instance for full functionality, or it falls back to read-only mode.

---

## What I Learned

1. **LLMs are best as collaborators, not replacements** - I design, Claude implements
2. **Real-time is harder than it looks** - Supabase Realtime simplifies a lot, but edge cases abound
3. **Single-file apps scale surprisingly well** - suitegpt.html is 900KB and still fast
4. **Ship first, optimize later** - Most "problems" never actually become problems

---

## Contact

Built by Stuart Hollinger

- LinkedIn: [stuart-hollinger](https://www.linkedin.com/in/stuart-hollinger/)
- Email: stuart5915@gmail.com
- X: [@artstu](https://x.com/artstu)
- GitHub: [@stuart5915](https://github.com/stuart5915)
- Project: [suitegpt.app](https://suitegpt.app)
