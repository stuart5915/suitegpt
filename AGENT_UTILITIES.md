# Inclawbate AI Agent Utilities — Master Buildout Plan

> Build each utility one at a time. Verify it works end-to-end before moving to the next.
> Each utility = an agent "skill" that can be triggered via API, shown in the UI, and earns credits.

---

## Status Key
- [ ] Not started
- [~] In progress
- [x] Done & verified

---

## 1. CONTENT & CREATIVE

### 1.1 Build Apps
- **Status:** [x] Done & verified
- **What it does:** Agent proposes an app idea → human approves → Gemini generates full HTML app → published to store
- **Endpoint:** `POST /api/swarm/build`
- **Model:** Gemini 2.0 Flash
- **Output:** Live app at `inclawbate.app/s/[slug]`
- **Notes:** This is the only fully working pipeline. All others build from this pattern.

### 1.2 Write Blog Posts / Articles
- **Status:** [ ] Not started
- **What it does:** Agent generates a full blog post with title, tags, SEO meta, and formatted HTML
- **Endpoint needed:** `POST /api/swarm/write-article`
- **Model:** Claude or Gemini
- **Output:** Published article at `inclawbate.app/blog/[slug].html`
- **Existing assets:** Article HTML template exists in CLAUDE.md, `/learn/` has examples
- **Build steps:**
  1. Create endpoint that takes a topic/brief and generates article content
  2. Format into the existing article HTML template
  3. Save as file or store in Supabase
  4. Add to blog listing page
  5. Wire to agent proposal flow (agent proposes article topic → approved → auto-writes)

### 1.3 Generate Social Media Posts
- **Status:** [ ] Not started (endpoint exists but not agent-connected)
- **What it does:** Agent generates tweet-length posts for X/Twitter
- **Existing endpoint:** `POST /api/inclawbate/generate-content` (Claude Sonnet)
- **What's missing:** Wire this to agent system so content_creator agents can auto-generate
- **Build steps:**
  1. Create agent-facing wrapper endpoint
  2. Store generated posts in a queue table
  3. Add UI to review/approve/post generated content
  4. Track which agent generated what

### 1.4 Create Social Content Calendars
- **Status:** [ ] Not started (endpoint exists but not agent-connected)
- **What it does:** Agent generates a 7-14 day content calendar across platforms
- **Existing endpoint:** `POST /api/socialpost` (Gemini)
- **What's missing:** Agent integration, storage, scheduling
- **Build steps:**
  1. Wire to agent system
  2. Store calendar in Supabase
  3. UI to view/edit/approve calendar
  4. Optional: auto-post via X API relay

### 1.5 Generate Marketing Copy
- **Status:** [ ] Not started
- **What it does:** Agent generates landing page copy, ad copy, email drafts, partnership pitches
- **Endpoint needed:** `POST /api/swarm/generate-copy`
- **Model:** Claude (better for persuasive writing)
- **Output:** Formatted text stored in Supabase, viewable in dashboard
- **Use cases:** App store descriptions, feature announcements, partnership outreach

### 1.6 Write App Documentation
- **Status:** [ ] Not started
- **What it does:** Agent takes an existing store app and generates user documentation / README
- **Endpoint needed:** `POST /api/swarm/generate-docs`
- **Model:** Claude or Gemini
- **Input:** App slug → fetch app code from `agent_apps` → analyze → generate docs
- **Output:** Markdown docs stored alongside the app

### 1.7 Generate Memes / ASCII Art
- **Status:** [ ] Not started
- **What it does:** Agent generates meme text, ASCII art, or image prompts for social content
- **Endpoint needed:** `POST /api/swarm/generate-meme`
- **Model:** Claude (good at ASCII), Gemini (image generation)
- **Output:** Text/image content for social posting
- **Notes:** Fun/viral utility, good for growth agents

---

## 2. TOKEN & DEFI ANALYSIS

### 2.1 Token Analysis Report
- **Status:** [ ] Not started
- **What it does:** Agent analyzes a token — price, market cap, liquidity, holders, risk signals
- **Endpoint needed:** `POST /api/swarm/analyze-token`
- **Data sources:** CoinGecko API, DexScreener API, Basescan API
- **Model:** Gemini or Claude to summarize findings into a readable report
- **Output:** Structured JSON + formatted report stored in Supabase
- **Build steps:**
  1. Fetch token data from CoinGecko/DexScreener
  2. Fetch contract info from Basescan
  3. AI summarizes into risk report
  4. Store and display in UI
  5. Agent can auto-run this on trending tokens

### 2.2 Smart Contract Risk Scan
- **Status:** [ ] Not started
- **What it does:** Agent fetches verified contract source from Basescan, runs pattern detection for common vulnerabilities
- **Endpoint needed:** `POST /api/swarm/scan-contract`
- **Data sources:** Basescan API (verified source code)
- **Model:** Claude (excellent at code analysis)
- **Output:** Risk report with flagged patterns (reentrancy, unlimited approval, honeypot indicators)
- **Notes:** Not a full audit — more like a quick safety check. Disclaimer needed.

### 2.3 Wallet Tracker
- **Status:** [ ] Not started
- **What it does:** Monitor a wallet address for significant transactions, token transfers, new positions
- **Endpoint needed:** `POST /api/swarm/track-wallet`
- **Data sources:** Basescan API, Alchemy/QuickNode
- **Output:** Activity feed / alerts stored in Supabase
- **Build steps:**
  1. Cron job polls watched wallets
  2. Detect large transfers, new token buys, contract interactions
  3. Store events and surface in UI
  4. Optional: webhook/notification

### 2.4 Yield Strategy Analysis
- **Status:** [ ] Not started
- **What it does:** Compare DeFi yields across Base protocols (Aerodrome, Aave, Compound, etc.)
- **Endpoint needed:** `POST /api/swarm/yield-analysis`
- **Data sources:** DeFiLlama API, protocol APIs
- **Model:** Gemini to summarize and recommend
- **Output:** Yield comparison table + AI recommendation

### 2.5 KOL / Influencer Tracking
- **Status:** [ ] Not started
- **What it does:** Track what crypto influencers are talking about, which tokens they mention
- **Endpoint needed:** `POST /api/swarm/kol-track`
- **Data sources:** X API (you have x-relay), social scraping
- **Model:** Claude to summarize sentiment
- **Output:** Feed of influencer activity + sentiment scores

### 2.6 Trading Signals (Technical Analysis)
- **Status:** [ ] Not started
- **What it does:** Generate technical analysis for a token — RSI, MACD, moving averages, support/resistance
- **Endpoint needed:** `POST /api/swarm/trading-signals`
- **Data sources:** CoinGecko historical data, TradingView data
- **Model:** Gemini to interpret indicators and generate trade thesis
- **Output:** Signal report with buy/sell/hold recommendation + chart data

---

## 3. BV7X TRADING PREDICTIONS INTEGRATION

### 3.1 BV7X BTC Prediction Agent
- **Status:** [ ] Not started
- **What it does:** AI agent analyzes BTC market data and submits price predictions on bv7x.ai/terminal
- **Partner:** BV7X (existing Inclawbate partner)
- **Endpoint needed:** `POST /api/swarm/bv7x-predict`
- **Build steps:**
  1. Research BV7X terminal API — how predictions are submitted, what format
  2. Agent fetches BTC price data, sentiment, technical indicators
  3. AI model generates prediction (price target + timeframe + confidence)
  4. Submit prediction to BV7X terminal via their API
  5. Track prediction accuracy over time
  6. Display agent's prediction history + win rate in UI
- **Model:** Gemini or Claude
- **Data sources:** CoinGecko BTC data, on-chain metrics, sentiment APIs
- **Notes:** Great partnership showcase. Show prediction accuracy on agents page.

---

## 4. APP & CODE QUALITY

### 4.1 Audit Store Apps
- **Status:** [ ] Not started
- **What it does:** Agent reviews an app from the store — checks code quality, accessibility, mobile responsiveness, security
- **Endpoint needed:** `POST /api/swarm/audit-app`
- **Input:** App slug → fetch code from `agent_apps`
- **Model:** Claude (best for code review)
- **Output:** Audit report with scores (0-100) for: code quality, accessibility, mobile, security, UX
- **Build steps:**
  1. Fetch app HTML from `agent_apps` or `user_apps`
  2. Send to Claude with audit rubric prompt
  3. Store audit results in Supabase
  4. Display audit badge/score on app listing
  5. QA agents auto-run this on new apps

### 4.2 Refine / Improve Existing Apps
- **Status:** [ ] Not started
- **What it does:** Agent takes an existing app and improves it — better UI, bug fixes, new features
- **Endpoint needed:** `POST /api/swarm/refine-app`
- **Input:** App slug + improvement brief
- **Model:** Gemini (generates full HTML like build endpoint)
- **Output:** New version of the app saved as v2
- **Notes:** Need versioning system for apps

### 4.3 Generate App Ideas
- **Status:** [ ] Not started (partially exists in wake endpoint)
- **What it does:** Agent brainstorms app ideas based on trending categories, gaps in the store, user requests
- **Endpoint needed:** Enhance existing `/api/swarm/wake`
- **Model:** Gemini
- **Output:** Proposal with app concept, target audience, key features

### 4.4 Automated QA / Bug Detection
- **Status:** [ ] Not started
- **What it does:** Agent loads an app, checks for JS errors, broken links, rendering issues
- **Endpoint needed:** `POST /api/swarm/qa-test`
- **Tools needed:** Headless browser (Playwright) or static analysis
- **Output:** Bug report with severity levels
- **Notes:** Could run automatically on every new app submission

---

## 5. COMMUNITY & GROWTH

### 5.1 Community Analytics Summary
- **Status:** [ ] Not started
- **What it does:** Summarize community activity — new users, top discussions, engagement metrics
- **Endpoint needed:** `POST /api/swarm/community-report`
- **Data sources:** Supabase user data, app usage stats
- **Model:** Claude to generate narrative summary
- **Output:** Weekly/daily community report

### 5.2 Partnership Outreach Drafts
- **Status:** [ ] Not started
- **What it does:** Agent generates personalized outreach messages for potential partners
- **Endpoint needed:** `POST /api/swarm/outreach-draft`
- **Input:** Partner name, their project, what we want
- **Model:** Claude
- **Output:** Draft DM/email ready to send

### 5.3 Onboarding Guide Generator
- **Status:** [ ] Not started
- **What it does:** Generate personalized getting-started guides based on what a user wants to do
- **Endpoint needed:** `POST /api/swarm/onboarding-guide`
- **Model:** Claude
- **Output:** Step-by-step guide tailored to user's goals (build apps, stake, trade, etc.)

---

## 6. DATA & RESEARCH

### 6.1 Project Research Report
- **Status:** [ ] Not started
- **What it does:** Agent researches a crypto project and generates a comprehensive report
- **Endpoint needed:** `POST /api/swarm/research-project`
- **Data sources:** CoinGecko, project website, social media
- **Model:** Claude + web search
- **Output:** Multi-section report (overview, team, tokenomics, risks, competitors)

### 6.2 Competitor Analysis
- **Status:** [ ] Not started
- **What it does:** Compare Inclawbate (or any project) against competitors
- **Endpoint needed:** `POST /api/swarm/competitor-analysis`
- **Model:** Claude
- **Output:** Comparison table + strengths/weaknesses + recommendations

### 6.3 Base Ecosystem Trend Detection
- **Status:** [ ] Not started
- **What it does:** Monitor what's trending on Base — new tokens, hot apps, TVL changes
- **Endpoint needed:** `POST /api/swarm/base-trends`
- **Data sources:** DeFiLlama, DexScreener, Basescan
- **Model:** Gemini to summarize
- **Output:** Daily/weekly trend report

### 6.4 Crypto News Aggregator
- **Status:** [ ] Not started
- **What it does:** Aggregate and summarize crypto news relevant to a topic or token
- **Endpoint needed:** `POST /api/swarm/news-summary`
- **Data sources:** RSS feeds, news APIs
- **Model:** Claude to summarize and extract key points
- **Output:** Curated news digest

---

## 7. AGENT-TO-AGENT COMMERCE (Future)

### 7.1 Service Marketplace
- **Status:** [ ] Not started
- **What it does:** Agents can list services and other agents can pay credits to use them
- **Inspiration:** Virtuals ACP (Agent Commerce Protocol)
- **Build steps:**
  1. Define service listing format (name, price in credits, input/output schema)
  2. Agents register services they can perform
  3. Other agents can discover and request services
  4. Credits transfer on completion
  5. Transaction log visible on agents page

### 7.2 Agent Collaboration Protocol
- **Status:** [ ] Not started (messaging exists)
- **What it does:** Agents can request help from other agents and collaborate on tasks
- **Existing:** Message endpoint exists (`/api/swarm/message`)
- **What's missing:** Structured collaboration flow (request → accept → deliver → rate)

---

## Suggested Build Order

**Phase 1 — Quick wins (wire up what exists)**
1. ~~1.1 Build Apps~~ (done)
2. 1.2 Write Blog Posts (template exists)
3. 1.3 Generate Social Posts (endpoint exists)
4. 4.1 Audit Store Apps (just needs Claude prompt)

**Phase 2 — High-value crypto utilities**
5. 2.1 Token Analysis Report
6. 2.6 Trading Signals
7. 3.1 BV7X BTC Prediction Agent
8. 2.2 Smart Contract Risk Scan

**Phase 3 — Growth & content engine**
9. 1.4 Social Content Calendars
10. 1.5 Marketing Copy
11. 5.2 Partnership Outreach Drafts
12. 6.1 Project Research Report

**Phase 4 — Advanced utilities**
13. 2.3 Wallet Tracker
14. 2.4 Yield Strategy Analysis
15. 4.2 Refine Existing Apps
16. 4.4 Automated QA

**Phase 5 — Ecosystem features**
17. 6.3 Base Ecosystem Trends
18. 6.4 News Aggregator
19. 2.5 KOL Tracking
20. 7.1 Service Marketplace

---

## Architecture Notes

**Every agent utility follows the same pattern:**
1. Agent (or user) triggers the skill via API
2. Endpoint fetches relevant data (APIs, Supabase, on-chain)
3. AI model (Gemini/Claude) processes data and generates output
4. Output stored in Supabase
5. Displayed in UI (agents page, dashboard, or dedicated view)
6. Agent earns credits for completed work

**Shared infrastructure needed:**
- CoinGecko API key (for token data)
- DexScreener API (free, no key needed)
- Basescan API key (for contract data)
- BV7X API integration (for predictions)
- DeFiLlama API (free, for yield data)
