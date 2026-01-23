# Agent Template

Use this template when creating a new SUITE agent.

## Quick Start

1. Copy this folder:
   ```bash
   cp -r agents/_template agents/[new-agent-slug]
   ```

2. Rename files:
   - `TEMPLATE_TELOS.md` → `[AGENTNAME]_TELOS.md`

3. Fill in placeholders:
   - Search for `[` and replace all bracketed placeholders
   - Update `CLAUDE.md` with agent identity
   - Update `[AGENTNAME]_TELOS.md` with mission details
   - Update `state.json` with agent ID and app slug
   - Update `integrations.json` with enabled integrations

4. Set up credentials:
   - Copy `.env.example` to `.env`
   - Get an `AGENT_API_KEY` from Supabase (see SQL below)
   - Fill in agent-specific credentials

5. Register in Supabase:
   ```sql
   INSERT INTO factory_users (
     display_name,
     is_agent,
     agent_slug,
     agent_api_key,
     owned_app_slug,
     telos_objective
   ) VALUES (
     '[Agent Display Name]',
     true,
     '[agent-slug]',
     'agent_' || encode(gen_random_bytes(24), 'hex'),
     '[app-slug]',
     '[One-line mission]'
   );
   ```

6. Add to factory.html dashboard (optional but recommended)

7. Test the agent:
   ```bash
   node scripts/wake-agent.js [agent-slug]
   ```

---

## Folder Structure

```
[agent-slug]/
├── CLAUDE.md              # Agent identity (Claude reads first)
├── [AGENT]_TELOS.md       # Mission and context
├── state.json             # Current execution state
├── integrations.json      # Available integrations
├── .env                   # Credentials (gitignored)
├── .env.example           # Credential template
│
├── knowledge/             # Domain knowledge
│   ├── README.md
│   ├── competitors.md
│   └── resources.md
│
├── assets/                # Media and branding
│   ├── README.md
│   ├── brand-guidelines.md
│   └── avatar.png         # (you add this)
│
├── history/               # Archived proposals
│   └── proposal-001.md    # (created by agent)
│
└── work/                  # Work in progress
    └── (agent writes here)
```

---

## Integration Options

Edit `integrations.json` to enable/disable capabilities:

| Integration | Purpose | Enable For |
|------------|---------|------------|
| `supabase` | Governance backend | All agents |
| `agent_api` | Submit proposals | All agents |
| `owned_app_api` | Read app data | All agents |
| `gemini` | AI content generation | Content creators |
| `x_twitter` | Social drafts | CT/social agents |
| `analytics` | Metrics access | Growth agents |
| `content_queue` | Article publishing | Content agents |

---

## Checklist

Before first wake:

- [ ] All `[placeholders]` replaced
- [ ] `state.json` has correct agent_id and owned_app
- [ ] `integrations.json` has correct capabilities enabled
- [ ] `.env` file created with valid AGENT_API_KEY
- [ ] Agent registered in Supabase factory_users
- [ ] Avatar image added to `assets/`
- [ ] Knowledge base populated with initial research
- [ ] Telos document filled in completely

---

## Tips

- **Start minimal**: Don't enable integrations you don't need yet
- **Fill knowledge first**: Better context = better proposals
- **Test incrementally**: Wake agent, see what it does, adjust
- **Review first proposals**: Calibrate agent by providing good feedback
