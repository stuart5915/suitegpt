# SUITE Autonomous Agents

This directory contains the autonomous agents that operate within the SUITE ecosystem governance system.

## Overview

Agents are AI-powered workers that:
- Propose improvements to their assigned apps
- Execute approved tasks autonomously
- Request human assistance when blocked
- Learn from feedback to improve over time

## Directory Structure

```
agents/
├── README.md                    # This file
├── AGENT_PROTOCOL.md            # Shared protocol all agents follow
├── integrations.schema.json     # JSON schema for integrations.json
├── .env.shared.example          # Template for shared credentials
│
├── _template/                   # Template for creating new agents
│   ├── README.md                # How to use this template
│   ├── CLAUDE.md                # Agent identity template
│   ├── TEMPLATE_TELOS.md        # Mission document template
│   ├── state.json               # Initial state template
│   ├── integrations.json        # Integration config template
│   ├── .env.example             # Credentials template
│   ├── knowledge/               # Domain knowledge
│   ├── assets/                  # Branding assets
│   ├── history/                 # Proposal archives
│   └── work/                    # Work in progress
│
├── foodvitals-agent/            # FoodVitals app agent
│   └── ...
│
└── defiknowledge-agent/         # DeFi Knowledge CT agent
    └── ...
```

## Agent Types

### App Agents
Focus on improving a specific app in the SUITE ecosystem.
- **Example:** foodvitals-agent
- **Capabilities:** App data, analytics, governance, content
- **Social:** Usually disabled (handled by dedicated social agents)

### Social/CT Agents
Focus on content creation and community engagement.
- **Example:** defiknowledge-agent
- **Capabilities:** Social drafting, image generation, trend monitoring
- **Special:** Can read social feeds, draft content for human approval

## Creating a New Agent

1. Copy the template:
   ```bash
   cp -r agents/_template agents/[new-agent-slug]
   ```

2. Follow the checklist in `_template/README.md`

3. Register the agent in Supabase

4. Test with:
   ```bash
   node scripts/wake-agent.js [agent-slug]
   ```

## Credentials Architecture

```
agents/
├── .env.shared          # Shared credentials (Supabase, Gemini, etc.)
│                        # All agents can access these
│
├── foodvitals-agent/
│   └── .env             # Agent-specific (AGENT_API_KEY, app keys)
│
└── defiknowledge-agent/
    └── .env             # Agent-specific (AGENT_API_KEY, X API keys)
```

**Rule:**
- Shared services → `.env.shared`
- Agent-specific → agent's `.env`

## Wake Cycle

Agents are woken by the wake script:

```bash
node scripts/wake-agent.js <agent-slug>
```

The wake script:
1. Loads agent state from `state.json`
2. Checks for governance responses (approvals, rejections, assistance)
3. Determines wake mode (propose, execute, continue, blocked)
4. Runs Claude in the agent's directory with appropriate context
5. Agent works until it submits something, then stops

## Governance Flow

```
Agent proposes → Human votes →
  ├── Approved → Agent executes → Completes or requests help
  └── Rejected → Agent learns → Proposes again
```

## Agent Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | First file agent reads; identity and pointers |
| `[AGENT]_TELOS.md` | Mission, app context, success metrics |
| `state.json` | Current execution state, learned patterns |
| `integrations.json` | Available services and capabilities |
| `.env` | Credentials (gitignored) |
| `knowledge/` | Domain knowledge base |
| `assets/` | Branding and media |
| `history/` | Archived proposals |
| `work/` | Work in progress |

## Useful Commands

```bash
# Wake an agent
node scripts/wake-agent.js foodvitals-agent

# List available agents
ls agents/*/state.json

# Check agent status
cat agents/foodvitals-agent/state.json | jq '.execution_state'
```

## Security Notes

- `.env` files are gitignored - never commit credentials
- Agents cannot post to social directly - humans approve and publish
- Agents cannot deploy code - humans review and deploy
- Agents cannot access external systems without explicit integration
