# SUITE Hub - Discord Bot Project

## Project Overview

SUITE Hub is a Discord-based community contributor system for the SUITE ecosystem. Members report bugs, suggest features, create content, and earn SUITE tokens for approved contributions.

---

## Current Status

### ✅ Completed
- Discord server name: **SUITE Hub**
- Logo generated: `suite-hub/logo.png`
- Banner generated: `suite-hub/banner.png`
- Welcome message: `suite-hub/welcome-message.md`

### ⏳ Needs Manual Setup (User does in Discord)
1. Create server roles (🔥 Forge Master, ⚡ Reviewer, 🌟 Top Contributor, 💎 Contributor)
2. Create channels (see below)
3. Paste welcome message in #welcome
4. Upload logo/banner

### 🔜 To Build (Technical)
- Gemini-powered Discord bot for processing submissions
- GitHub integration for issue creation
- Weekly SUITE payout tracking

---

## Discord Channel Structure

```
📢 INFO
├── #welcome (read-only)
├── #announcements (read-only)

🔨 FORGE (Development)
├── #submit-bugs (anyone)
├── #submit-features (anyone)
├── #pending (read-only, bot posts)
├── #approved (read-only)
├── #shipped (read-only)

📣 CREATE (Content)
├── #content-bounties (read-only)
├── #submit-content (anyone)
├── #showcase (read-only)

💰 REWARDS
├── #leaderboard (read-only)
├── #payouts (read-only)

💬 COMMUNITY
├── #general (anyone)
├── #introductions (anyone)
```

---

## Discord Roles

| Role | Color | Permissions |
|------|-------|-------------|
| 🔥 Forge Master | Gold | Admin, approve all |
| ⚡ Reviewer | Purple | Can approve submissions |
| 🌟 Top Contributor | Green | Badge only |
| 💎 Contributor | Blue | Badge only |
| 👋 Member | Gray | Default, submit only |

---

## Reward Structure

### Development (FORGE)
| Action | SUITE Earned |
|--------|-------------|
| Bug report approved | 500 SUITE |
| Feature idea approved | 1,000 SUITE |
| Fix shipped | +500-1,000 bonus |

### Content (CREATE)
| Action | SUITE Earned |
|--------|-------------|
| Tutorial video | 5,000 SUITE |
| Twitter thread | 1,000 SUITE |
| TikTok/Short | 2,000 SUITE |
| Blog post | 3,000 SUITE |

**Weekly payout pool: ~50,000 SUITE ($50)**

---

## Bot Architecture (To Build)

```
User posts in #submit-features
        ↓
Bot (Gemini) refines & categorizes
        ↓
Bot posts clean ticket in #pending
        ↓
Reviewer reacts with ✅ or ❌
        ↓
If approved → #approved
        ↓
When shipped → #shipped + contributor credited
```

### Tech Stack
- Node.js + Discord.js
- Google Gemini API for AI processing
- GitHub API for issue creation
- SUITE token contract for payouts

---

## Files Location

All SUITE Hub files are in:
```
c:\Users\info\.gemini\antigravity\scratch\stuart-hollinger-landing\suite-hub\
├── logo.png
├── banner.png
├── welcome-message.md
└── HANDOFF.md (this file)
```

---

## Next Steps for Agent

1. **Help user create Discord server** (if not done)
2. **Guide channel/role setup**
3. **Build Discord bot** with:
   - Gemini integration
   - Submission processing
   - Approval workflow
   - Payout tracking

---

## Related Contracts

| Contract | Address |
|----------|---------|
| SUITE Token | `0xE6892803DF59D79cFB4794e7da9549df4eE70f71` |
| TreasuryV4 | `0xf121C51E18aD8f8C9B38EEAA377aD4393E16e3d1` |

Network: Base Mainnet (Chain ID: 8453)
