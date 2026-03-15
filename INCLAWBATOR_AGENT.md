# Inclawbator Agent

> The agent that takes any idea and turns it into a launched, funded, and permanently rewarded crypto project on Base.

## One-Liner

Inclawbator is a full-lifecycle project agent. It discovers, launches, grows, and maintains crypto projects — end to end — so creators (human or AI) never have to figure out the infra themselves. Every project launched through Inclawbator gets a self-sustaining reward loop powered by CLAWS.

## Why Other Agents Would Use It

No other agent on Bankr, Virtuals, or any platform can do what Inclawbator does. Bankr agents can trade. They can launch a token. But they can't build a full branded project with a staking pool, landing page, app store listing, X presence, marketing pipeline, AND an automated reward system that feeds stakers forever.

The pitch to other agents: "Give me a concept. I'll launch the token, deploy staking, create the website, list it in the ecosystem, set up automated promotion, and your stakers will earn CLAWS rewards forever — funded automatically by your token's own trading activity. You don't need to know how any of that works."

---

## The CLAWS Reward Flywheel

This is the core value proposition. Every project launched through Inclawbator gets this automatically:

```
Token launches on Base via Clanker
         │
         ▼
People trade the token on Uniswap
         │
         ▼
LP trading fees generated (1.2% via Clanker)
         │
    ┌────┴────┐
    │         │
   80%       20%
 Creator   Inclawbate
    │         │
    │         ▼
    │   Auto-swap to CLAWS (via 0x/Uniswap)
    │         │
    │         ▼
    │   Deposit as staking rewards
    │   into the project's staking pool
    │         │
    │         ▼
    │   Stakers earn CLAWS rewards
    │         │
    │         ▼
    │   More people stake the token
    │         │
    │         ▼
    │   Stronger community + buy pressure on CLAWS
    │         │
    └─────────┘
        ↻ Loop
```

**Key details:**
- The 20% fee → CLAWS conversion → staking deposit is **fully automated** (backend cron on Railway)
- Staking pools have **dual depositor authorization**: both the creator wallet AND `inclawbate.base.eth` can deposit rewards
- Creator can ALSO deposit their own rewards anytime (their 80% share, or any other tokens)
- The platform dashboard shows accumulated fees, CLAWS purchased, and rewards distributed per project — full transparency
- This means: **as long as people trade the token, stakers earn CLAWS. Forever. No manual intervention.**

### Contract Changes Required
- `ClawnchRewardsLite.sol` updated with `rewardDepositors` mapping — multiple authorized wallets can call `depositRewards()`
- New `StakingFactory v3` auto-registers `inclawbate.base.eth` as a depositor on every new pool
- Creator remains admin (can add/remove depositors, set parameters)

---

## Services

### Phase 1: Pre-Launch (Discovery)

| Service | Description | Status |
|---------|-------------|--------|
| **Browse Apps** | Search the Inclawbate app store for existing solutions before building from scratch | Live |
| **Suggest Ideas** | Curated app/project ideas across DeFi, gaming, social, tools, AI categories | Live |
| **Ecosystem Info** | Overview of the entire Inclawbate ecosystem, tokens, features, links | Live |
| **Incubation Info** | Detailed breakdown of what full incubation includes, tiers, process, cost | Live |

### Phase 2: Launch (Build & Deploy)

| Service | Description | Status |
|---------|-------------|--------|
| **Launch Token** | Deploy ERC-20 on Base via Clanker v4 or Solana via Bags/Meteora. Configurable supply, dev buy, fee recipients, creator vault, airdrop allocation, lockup/vesting, sniper tax. Fee split auto-configured: 80% creator / 20% Inclawbate (→ CLAWS rewards) | **Live** (full UI + chat wired via `launch_token_info` + `configure_token_launch`) |
| **Deploy Staking Pool** | Create staking contract via Staking Factory v3. Dual-depositor: creator + inclawbate.base.eth both authorized. CLAWS as reward token. Automated reward flow from day one | Needs contract update |
| **Build Landing Page** | Generate and deploy a branded project page on inclawbate.com via publish-site API | **Live** (agent guides to /build via `build_landing_page`) |
| **Register in Ecosystem** | List in the Inclawbate app store and ecosystem directory with metadata, links, and tags | **Live** (agent guides registration via `register_project`) |
| **Set Up X Agent** | Configure automated X/Twitter posting with custom persona and frequency (1-48 posts/day) | **Live** (agent wired via `setup_x_agent`, scrolls to agents section) |
| **Marketing Pipeline** | Book paid promo slots on @inclawbate X. 3 tiers: Shoutout/Campaign/Featured, pay in CLAWS | **Live** (API at `/api/inclawbate/promo`, agent wired via `book_promo`) |

### Phase 3: Post-Launch (Grow)

| Service | Description | Status |
|---------|-------------|--------|
| **Token Analytics** | Report on token price, volume, liquidity, holder count via DexScreener + on-chain data | **Live** (wired to agent via `get_token_analytics`) |
| **Staking Analytics** | TVL, APY, total stakers, reward distribution rate, CLAWS earned to date | **Live** (wired to agent via `get_staking_stats`) |
| **Airdrop / Disperse** | Distribute tokens to a list of wallets. Swap + multi-send via 0x and Disperse.app | Live (tool exists on /inclawbator, not wired to agent) |
| **Fee Revenue Report** | Show creator their 80% LP fee earnings, total volume, and how much CLAWS has been bought + deposited from the 20% | Not built |
| **Promo Booking** | Pay CLAWS to get promotional posts on the @inclawbate X account. 3 tiers: Shoutout (1 post, 10K CLAWS), Campaign (5 posts, 40K CLAWS), Featured (daily for 2 weeks, 100K CLAWS) | **Live** (API + agent wired via `book_promo`) |

### Phase 4: Ongoing Management (Sustain)

| Service | Description | Status |
|---------|-------------|--------|
| **Project Health Check** | Pull DexScreener data, holder count, staking stats, X engagement. Honest assessment + actionable suggestions | Not built |
| **Agent Refuel** | Monitor X agent credit balance. Alert when low. Auto-refill or prompt creator to top up | Not built |
| **Staking Rewards Monitor** | Track the automated CLAWS reward deposits. Alert if trading volume drops and rewards slow down. Suggest creator top-up if needed | Not built |
| **Cross-Promotion** | Connect projects in the ecosystem for co-marketing. Match complementary communities | Not built |
| **Hire an Inclawbator** | Connect creators with vetted human Inclawbators for tasks the agent can't automate — logo design, smart contract work, marketing strategy, content writing. Pay in CLAWS, direct wallet-to-wallet | **Live** (directory on /inclawbator, browse + hire wired to agent) |

---

## Inclawbators (Human Incubators)

The Inclawbator **agent** handles the automated infra — token launch, staking pool, landing page, X agent, reward pipeline. But some things need a human touch. That's what **Inclawbators** are: vetted humans on the platform who can be hired to incubate projects.

### What Inclawbators Do

| Specialty | Examples |
|-----------|----------|
| **Design** | Logo, branding, landing page design, NFT art |
| **Development** | Custom smart contracts, app features, integrations |
| **Marketing** | Strategy, content calendars, community building, X growth |
| **Tokenomics** | Supply design, fee structure, staking reward planning |
| **Content** | Articles, threads, announcements, pitch decks |
| **Community** | Telegram/Discord moderation, onboarding, engagement |

### The /inclawbators Page

A directory of available human Inclawbators showing:
- Name / handle
- Specialties and skills
- Past projects they've incubated (with links)
- Response time / availability
- Hire count / track record
- Rate (in CLAWS)
- "Hire" button — payment direct wallet-to-wallet, zero platform fee

### How It Works With the Agent

When someone asks the Inclawbator agent to launch a project and needs something the agent can't automate:

1. Agent identifies the need (e.g., "I need a logo for my project")
2. Agent searches available Inclawbators by specialty (e.g., design)
3. Agent recommends a match: "I'd suggest hiring @artstu — they've incubated 12 projects and specialize in crypto branding"
4. Creator confirms → agent initiates the hire via Inclawbate
5. Inclawbator gets notified (Telegram), delivers the work
6. Payment happens in CLAWS, wallet-to-wallet

**The agent + humans together = full-service incubation.** The agent does what machines do best (deploy contracts, configure systems, monitor data). The humans do what humans do best (create, strategize, build relationships).

### Backend (exists)
- **API:** `/api/inclawbate/humans` (search/browse), `/api/inclawbate/conversations` (create hire), `/api/inclawbate/messages` (communicate + deliver)
- **Payment:** CLAWS on Base, zero platform fee, direct wallet-to-wallet
- **Notifications:** Telegram DM to Inclawbator when hired

---

## What a Creator Gets (End-to-End)

When someone (human or AI agent) asks Inclawbator to launch a project, here's everything they walk away with:

**Automated (by the agent):**
1. **ERC-20 token** on Base with configured supply and fee recipients
2. **Staking pool** where their community stakes their token and earns CLAWS rewards
3. **Automated reward funding** — 20% of all trading fees auto-convert to CLAWS and flow to stakers
4. **Landing page** on inclawbate.com with their branding
5. **App store listing** in the Inclawbate ecosystem directory
6. **X/Twitter agent** posting about their project on a schedule with custom voice
7. **Marketing slots** in the Inclawbate X schedule
8. **Analytics dashboard** showing token performance, staking stats, fee revenue
9. **Ongoing monitoring** with health checks and optimization suggestions

**Human-powered (by Inclawbators):**
10. **Custom branding** — logo, visual identity, design assets
11. **Smart contract work** — custom features beyond standard templates
12. **Marketing strategy** — tailored growth plan, content calendar
13. **Community setup** — Telegram/Discord creation and moderation
14. **Content creation** — launch threads, articles, announcements

**Cost: Free.** Inclawbate's 20% fee split funds itself through the CLAWS flywheel. Human Inclawbators are paid separately in CLAWS by the creator (rates set by each Inclawbator).

---

## Agent Personality

- Friendly, concise, helpful
- Recommends existing apps before suggesting new builds
- Encourages self-building via /build before offering full incubation
- Only suggests full incubation when the project genuinely needs hands-on help
- Never makes up data — always uses tools to fetch real info
- Speaks like a knowledgeable friend, not a corporate bot
- Explains the CLAWS reward flywheel clearly when pitching incubation

## Routing Logic

1. User asks about something → check if an existing app solves it (browse_apps)
2. User wants to build something simple → suggest ideas + point to /build (no-code builder)
3. User wants full-service launch → explain incubation + CLAWS flywheel, confirm intent, collect details, submit application
4. User needs custom/creative work → recommend an Inclawbator (human) and facilitate the hire
5. User has an existing project → offer post-launch services (analytics, distribution, health check)
6. Another agent asks what Inclawbator does → pitch the full lifecycle + reward flywheel + human Inclawbators

---

## Platform Presence

| Platform | Role | Status |
|----------|------|--------|
| **Virtuals ACP** | Provider agent offering incubation + check_application jobs | Registered |
| **Bankr** | Skill that any Bankr agent can install for full incubation, hiring Inclawbators, analytics | Not yet (planned) |
| **Inclawbate.com** | Chat widget on /inclawbator page | Live (frontend exists, agent not deployed) |

## Virtuals Registration

- **Agent name:** inclawbate
- **Role:** Provider
- **Wallet:** `0x479b3269a6807de199AC7344F72B5169a9B2BF47`
- **GAME API Key:** `apt-1693a83e9ef406ba86f84467e0d971cf`
- **Jobs:** incubation ($0.01, 12hr SLA), check_application ($0.01, 5min SLA)
- **Resources:** ecosystem_info (inclawbate.com), incubation_info (inclawbate.com/inclawbator)

---

## Inclawbate Skills (Agent Capabilities for Other Platforms)

These are packaged capabilities that the Inclawbator agent exposes. Other agents on Bankr, Virtuals, or any platform can use these skills to tap into Inclawbate's infrastructure:

### Hire an Inclawbator (Human Hiring)
- Search available human Inclawbators by skill, availability, timezone
- View profiles: specialties, past projects, response time, track record
- Hire for tasks — pay in CLAWS, zero platform fee, direct wallet-to-wallet
- Communicate + receive deliverables through the platform
- **API:** `/api/inclawbate/humans`, `/api/inclawbate/conversations`, `/api/inclawbate/messages`

### Token Analytics
- Real-time price, volume, liquidity for any Inclawbate ecosystem token
- Staking TVL, APY, distribution rates
- Platform-wide metrics
- **API:** `GET /api/inclawbate/analytics`

### Staking
- Stake/unstake tokens on-chain
- Read staking positions by wallet
- Check reward balances and claim status
- **Contract:** `0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6` (Base)
- **API:** `GET /api/inclawbate/staking`

### Full Incubation
- Launch a token, deploy staking, build a page, register in ecosystem, set up X agent, configure the CLAWS reward flywheel — all in one request
- The flagship skill: no other platform offers this end-to-end
- **API:** `/api/inclawbate/inclawbator`

---

## Revenue Model

- **Incubation is free** for creators
- Inclawbate takes a configurable fee split from LP trading fees (default: 20% Inclawbate / 80% creator)
- **The 20% Inclawbate fee is used to purchase CLAWS on the open market and deposit it as staking rewards into the project's staking pool.** This creates a self-reinforcing loop: trading activity → fees → CLAWS buy pressure → staking rewards for the project's community. Every project launched through Inclawbate directly strengthens the CLAWS ecosystem.
- Agent credits: 10 free on launch, then funded by anyone depositing CLAWS via feed-agent endpoint
- Human Inclawbators: zero platform fee, direct wallet-to-wallet payment in CLAWS (rates set by each Inclawbator)
- **Promo slots (Marketing-as-a-Service):** Projects pay CLAWS to get promoted on the @inclawbate X account. 3 tiers: Shoutout (1 post, 10K CLAWS), Campaign (5 posts/week, 40K CLAWS), Featured (daily for 2 weeks, 100K CLAWS). CLAWS payments go to `inclawbate.base.eth`. API: `/api/inclawbate/promo`. Table: `promo_queue`.

---

## Technical Details

### Automated Reward Pipeline

```
Clanker LP fees (20% to inclawbate.base.eth)
         │
         ▼
Railway cron job (runs periodically)
    1. Check accumulated fees per project
    2. Swap fees → CLAWS via 0x API
    3. Call depositRewards() on project's staking pool
    4. Log distribution in Supabase (inclawbator_distributions table)
         │
         ▼
Project stakers earn CLAWS automatically
```

**Requirements:**
- `inclawbate.base.eth` registered as authorized depositor on each staking pool (set by factory at deploy time)
- CLAWS token approved for staking pool contract
- Cron job has access to platform wallet private key for signing swaps + deposits

### Staking Contract Architecture

**Current:** Single admin can deposit rewards
**Updated (v3):** Multiple authorized depositors via `rewardDepositors` mapping

```
┌─────────────────────────────┐
│     Staking Pool (Clone)     │
│                              │
│  admin: creator wallet       │
│  rewardDepositors:           │
│    - inclawbate.base.eth ✓   │
│    - (creator can add more)  │
│                              │
│  depositRewards() ← admin    │
│                    ← depositors │
│  transferAdmin()  ← admin only │
│  setDepositor()   ← admin only │
└─────────────────────────────┘
```

### Code Locations

| File | Purpose |
|------|---------|
| `virtuals-agent/agent.js` | Main agent — ChatAgent + 6 GameFunctions, HTTP server |
| `virtuals-agent/.env.example` | Env vars template (GAME_API_KEY, AGENT_JWT) |
| `virtuals-agent/Dockerfile` | Docker config for Railway deployment |
| `api/inclawbate/inclawbator.js` | Backend — project registry, agent CRUD, distributions |
| `inclawbate/inclawbator.html` | Frontend — launchpad UI with all tools |
| `inclawbate/contracts/contracts/ClawnchRewardsLite.sol` | Staking pool implementation (needs multi-depositor update) |
| `inclawbate/contracts/contracts/StakingFactory.sol` | Factory that deploys staking pools (needs v3 update) |
| `openclaw-skill/inclawbate/SKILL.md` | Human hiring skill spec |
| `openclaw-skill/inclawnch-analytics/SKILL.md` | Token analytics skill spec |
| `openclaw-skill/inclawnch-staking/SKILL.md` | Staking skill spec |

### Current Agent Functions (in agent-chat.js — 21 tools)

| Function | Params | Backend | Status |
|----------|--------|---------|--------|
| `browse_apps` | search?, category? | `/api/inclawbate/apps` | Live |
| `suggest_app_ideas` | interest? | Hardcoded | Live |
| `get_ecosystem_info` | none | Hardcoded | Live |
| `get_incubation_info` | none | Hardcoded | Live |
| `get_basis_vaults` | sort? | `/api/basis/marketplace` | Live |
| `get_staking_info` | none | Hardcoded (CLAWS staking overview) | Live |
| `launch_token_info` | none | Opens launch panel | Live |
| `configure_token_launch` | token_name, symbol, description, image_url, website_url, x_handle, telegram_url, chain | Fills launch form (Base/Solana) | Live |
| `build_app_info` | none | Hardcoded (guides to /build) | Live |
| `create_agent_info` | none | Hardcoded (guides to dashboard) | Live |
| `create_staking_info` | none | Hardcoded (staking pool info) | Live |
| `get_user_workspace` | wallet | `/api/inclawbate/apps`, `/api/inclawbate/projects`, `/api/basis/marketplace` | Live |
| `get_token_analytics` | token_address | DexScreener API | Live |
| `setup_x_agent` | none | Scrolls to marketing agents section | Live |
| `get_project_status` | wallet | `/api/inclawbate/inclawbator` | Live |
| `browse_inclawbators` | skill? | `/api/inclawbate/humans` | Live |
| `hire_inclawbator` | handle, task_description?, skill? | Guides hiring process (CLAWS payment) | Live |
| `build_landing_page` | project_name?, description? | Opens /build in new tab | Live |
| `register_project` | project_name?, token_address?, chain? | Guides registration process | Live |
| `get_staking_stats` | wallet? | `/api/inclawbate/staking` (live TVL, APY, wallet position) | Live |
| `book_promo` | project_name?, tier? | Shows promo tiers + booking process | Live |

### Functions Still Needed

| Function | Params | Backend |
|----------|--------|---------|
| `deploy_staking` | token_address, reward_token? | Needs StakingFactory v3 contract update |
| `get_fee_report` | project_id | New endpoint needed |
| `disperse_tokens` | token_address, recipients[] | 0x + Disperse.app |
| `health_check` | project_id | Composite: DexScreener + staking + X metrics |
| `check_hire_status` | conversation_id | `/api/inclawbate/messages` |

### Backend Actions (inclawbator.js)

| Action | Auth | Description |
|--------|------|-------------|
| `register` | JWT | Submit incubation application |
| `approve` | Admin | Approve pending application |
| `update-staking` | Owner | Set staking contract address |
| `record-distribution` | Admin | Log reward distribution |
| `update-fees` | Admin | Update fees claimed |
| `feed-agent` | Public | Deposit CLAWS credits to agent |
| `launch-agent` | JWT | Create X posting agent for a project |
| `delete-application` | Owner | Delete pending application |
| `update-application` | Owner | Update application fields |
| `update-project` | Owner | Update project appearance |
| `record-allocation-claim` | Owner | Record on-chain allocation claim |

### Deployment

- **Runtime:** Node.js
- **Framework:** Virtuals Protocol Game SDK
- **Hosting:** Railway (Dockerfile ready, not currently deployed)
- **Port:** 3000
- **Session state:** In-memory Map (not persistent across restarts)

---

## Roadmap

### Phase A: Contract + Infra (do first)
1. Update `ClawnchRewardsLite.sol` with `rewardDepositors` mapping
2. Update `StakingFactory` to v3 — auto-register `inclawbate.base.eth` on new pools
3. Deploy updated contracts to Base
4. Build Railway cron job for automated fee → CLAWS → staking reward pipeline

### Phase B: Inclawbators Page + Hiring (do second)
5. Build `/inclawbators` page — directory of available human Inclawbators with profiles, skills, past projects, rates
6. Wire browse_inclawbators, hire_inclawbator, check_hire_status into agent.js
7. Connect to existing humans API backend

### Phase C: Wire Agent Functions (do third)
8. Add launch_token, deploy_staking, build_landing_page, register_project, setup_x_agent to agent.js
9. Add get_token_analytics, get_staking_stats, get_fee_report
10. Add disperse_tokens, health_check
11. Deploy agent to Railway

### Phase D: Distribution (do fourth)
12. Package as Bankr skill
13. Create agent profile on bankr.bot/agents
14. Add chat widget to inclawbate.com/inclawbator

### Phase E: Polish (ongoing)
15. Cross-promotion matching between ecosystem projects
16. Agent credit auto-refuel from fee revenue
17. Staking rewards low-balance alerts
18. Fee claiming walkthrough for creators
