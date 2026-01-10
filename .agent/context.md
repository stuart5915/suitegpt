# Stuart's SUITE Ecosystem - AI Context Document
> **When to use:** Reference this at the start of new conversations or when context is lost.
> **Last Updated:** January 10, 2026

---

## 🎯 Who is Stuart?

Stuart Hollinger is building a personal app ecosystem called **SUITE** - a collection of mobile apps and web tools designed for self-improvement, productivity, and eventually decentralized giving through tokenomics.

- **Primary Machine:** PC (Windows, 32GB RAM) - runs Antigravity IDE for heavy AI coding
- **Secondary Machine:** Laptop (Windows) - used for reviewing, light edits, and sending prompts
- **Deployment:** Apps deploy via Expo Go, website via GitHub Pages (getsuite.app)

---

## 🏗️ Project Structure

### Main Repository: `stuart-hollinger-landing`
```
stuart-hollinger-landing/
├── index.html          # Landing page (getsuite.app)
├── apps.html           # Apps showcase page
├── wallet.html         # $SUITE wallet integration
├── treasury.html       # Treasury/giving page
├── dashboard.html      # Developer dashboard (integrated portal)
├── docs/               # Documentation pages
│   ├── index.html      # Docs home
│   ├── ecosystem.html  # Interactive overview
│   ├── how-it-works.html # Technical pipeline
│   ├── tokenomics.html # $SUITE token docs
│   └── sidebar.js      # Shared sidebar component
├── prompt-server/      # ⚡ BIDIRECTIONAL CODING SYSTEM
│   ├── server.py       # Flask API (runs on both laptop & PC)
│   ├── watcher.py      # Polls Supabase, injects into Antigravity
│   ├── index.html      # Laptop portal UI
│   └── screenshots/    # Captured AI responses
└── .agent/             # AI context files
    └── context.md      # THIS FILE
```

---

## ⚡ Bidirectional Coding System

This is Stuart's custom dual-machine coding workflow:

### How It Works:
1. **Laptop** sends prompts via portal UI → Supabase
2. **PC's watcher.py** polls Supabase for pending prompts
3. Watcher injects prompts into Antigravity windows using pyautogui
4. After AI completes, watcher pushes to GitHub
5. Laptop auto-pulls changes

### Key Components:

#### `watcher.py` (PC only) - Instant Dispatch Architecture

**Main Thread (Prompt Dispatcher):**
1. Polls Supabase every 5 seconds for pending prompts
2. **Instant dispatch** - Types prompt to window, presses Enter, returns immediately
3. Marks prompt as "sent" (no waiting for completion)
4. Round-robin across 4 window slots

**Background Thread (Accept Sweep + Git Sync):**
Runs continuously in parallel:
- **Every 5 seconds:** Sweeps ALL windows with Accept click + Alt+Enter + Scroll
- **ONLY if no slot is typing** (waits if text is being output)
- **Every 60 seconds:** Does git pull + git push to sync with GitHub

**Flow Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN THREAD                              │
│  Poll Supabase → Get Prompt → Type to Window → Return       │
│                (instant, no waiting)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKGROUND THREAD                           │
│  Every 5s: Accept sweep (if not typing)                     │
│  Every 60s: Git pull + push (if not typing)                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Flags:**
- `slot_typing[i]` - True while pyautogui is typing to slot i
- `slot_busy[i]` - True while prompt is active in slot i (persisted to file)

#### `server.py` (Both machines)
- **On PC (10.0.0.142:3000):** Receives prompts, serves portal
- **On Laptop (localhost:3000):** Pull/push controls, auto-sync toggles
- **Endpoints:**
  - POST /send - Queue new prompt
  - GET /needs-review - Get prompts where AI asked questions
  - POST /respond - Send response to AI
  - POST /dismiss-prompt - Dismiss a needs-review prompt
  - POST /upload-image - Upload image attachment
  - GET /screenshots/<id>.png - Serve captured screenshots

#### `index.html` (Portal UI)
- **Smart Prompt Builder:** Project pills, type pills, page/section selectors
- **Image Attachment:** Paste (Ctrl+V) or click to attach screenshots
- **Needs Attention section:** Shows prompts where AI asked questions with screenshots
- **Response input:** Type and send responses directly to specific window slots
- **Sync controls:** Pull, push, auto-pull toggle

### Window Slots (Monitor 2):
```
┌─────────────────┬─────────────────┐
│   Slot 0        │   Slot 1        │
│   Top-Left      │   Top-Right     │
├─────────────────┼─────────────────┤
│   Slot 2        │   Slot 3        │
│   Bottom-Left   │   Bottom-Right  │
└─────────────────┴─────────────────┘
```

---

## 📱 SUITE Apps

| App | Description | Repo |
|-----|-------------|------|
| **FoodVitals** | AI nutrition tracking, meal suggestions | food-vitals-expo |
| **Cheshbon** | Jewish reflection/journal app | cheshbon-reflections |
| **TrueForm** | AI physiotherapy exercises | trueform-ai-physiotherapist |
| **LifeHub** | Personal AI assistant with memories | life-hub-app |
| **OpticRep** | AI workout trainer with form analysis | opticrep-ai-workout-trainer |
| **REMcast** | Dream journaling | remcast |

---

## 💰 Tokenomics ($SUITE)

- **Token:** $SUITE on Base network
- **Treasury:** Smart contract holds ETH backing
- **Model:** Microtransaction-based - pay per AI feature use
- **Giving:** After $100k treasury, 10% goes to charitable causes
- **Floor Price:** Treasury guarantees minimum token value

---

## 🔌 External Services

| Service | Purpose |
|---------|---------|
| **Supabase** (rdsmdywbdiskxknluiym) | Prompts table, app data |
| **GitHub** (stuart5915) | Code hosting, GitHub Pages |
| **Railway** | FORGE Discord bot hosting |
| **Discord** | /addition command for remote prompts |
| **Expo** | Mobile app development/deployment |

---

## 🛠️ Common Tasks

### Start Coding Session (PC):
```powershell
# Terminal 1 - Server
cd C:\Users\Stuart\stuart-hollinger-landing\prompt-server
python server.py

# Terminal 2 - Watcher
cd C:\Users\Stuart\stuart-hollinger-landing\prompt-server
python watcher.py

# Open 2-4 Antigravity windows, tile on monitor 2
```

### Start Coding Session (Laptop):
```powershell
# Terminal 1 - Local server for sync controls
cd c:\Users\info\Documents\stuart-hollinger-landing\prompt-server
python server.py

# Terminal 2 - Website preview
cd c:\Users\info\Documents\stuart-hollinger-landing
python -m http.server 8000

# Open http://10.0.0.142:3000 for portal
```

### Deploy Website:
```powershell
git add -A
git commit -m "message"
git push
# GitHub Pages auto-deploys to getsuite.app
```

---

## ⚠️ Known Issues / Gotchas

1. **Supabase key required:** Set `$env:SUPABASE_SERVICE_KEY` before running watcher
2. **Window coordinates:** Hard-coded in watcher.py - if window positions change, coords need updating
3. **pyautogui typewrite:** Only works with ASCII - emojis/unicode get stripped
4. **Screenshot regions:** May need adjustment if window sizes change

---

## 📋 Recent Session Log

*Update this section with what was accomplished in recent sessions:*

### January 10, 2026
- Added Smart Prompt Builder UI (project pills, type pills, page/section selectors)
- Fixed watcher race condition (slot_typing flag)
- Added needs-review detection when AI asks questions instead of coding
- Added screenshot capture of Antigravity window for needs-review prompts
- Added response feature to reply to AI questions from laptop
- Enhanced git push resilience with retry/rebase logic
