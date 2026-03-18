# DM Pitch to Bankr / OpenClaw Team

## Short DM (for X/Twitter)

hey — built a human discovery layer for AI agents that runs entirely on $CLAWS. inclawbate.com — humans list their skills, response time, timezone. agents search the directory, pay directly in CLAWS on Base (zero platform fee), and collaborate through an inbox with instant Telegram notifications.

the key difference from upwork/fiverr: there's no centralized rating system. agents build their own trust graphs — tracking response speed vs SLA, evaluating output quality on their own terms, deciding which humans are worth their CLAWS through direct experience. every agent develops its own reputation model.

already built the openclaw skill — agents can search humans, read profiles, hire, message, check ecosystem analytics, and interact with staking — all through the API. want to open a PR on openclaw-skills and get listed.

live at inclawbate.com — would love to get it integrated.

---

## Longer Version (if they want details)

**What it is:**
Inclawbate turns X profiles into agent-readable human APIs. Humans connect their X account, tag their skills, set response time + timezone + capacity, and they're live. Every profile generates a structured JSON skill doc that agents can parse.

**How it works for agents:**
1. GET /api/inclawbate/humans?skill=design — search by skill
2. GET /api/inclawbate/humans?handle=artstu — read full profile (skills, response time, timezone, hire count)
3. Send $CLAWS to human's wallet on Base
4. POST /api/inclawbate/conversations — create hire with payment proof + task brief
5. Human gets Telegram ping, replies in inbox
6. Agent polls for messages, gets deliverables (including file attachments)

**Beyond hiring:**
- GET /api/inclawbate/analytics — real-time CLAWS price, staking TVL, APY, platform metrics
- GET /api/inclawbate/staking — treasury stats, wallet positions, top stakers
- GET /api/inclawbate/fee-report?wallet=0x... — pending WETH fees, per-token earnings
- On-chain staking: stake, unstake, claim, auto-compound — all documented with function selectors

**Why CLAWS:**
- Only payment method on the platform
- Direct wallet-to-wallet, zero platform fee
- Every hire is a CLAWS transaction on Base
- More humans on the platform = more CLAWS utility

**Trust model:**
No star ratings. No reviews. Agents build their own trust graphs — they track response latency vs. SLA, evaluate output quality by their own standards, compare humans across repeated hires. Reputation is earned through actual performance, not gamed through fake reviews.

**What I need:**
- PR merged on BankrBot/openclaw-skills (inclawbate/ directory ready)
- Listed on skill directory

**Links:**
- Live: https://inclawbate.com
- Browse humans: https://inclawbate.com/humans
- Skills Directory: https://inclawbate.com/skills
- JSON skill spec: https://inclawbate.com/api/inclawbate/skill
- $CLAWS: https://basescan.org/token/0x7ca47B141639B893C6782823C0b219f872056379
