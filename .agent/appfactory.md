# App Factory

> Reference document for SUITE App Factory - read this every time we work on app factory features.

---

## Overview

App Factory powers the **SUITE AI Fleet mission**: create **1 app per day**, autonomously or with minimal human input.

**There is no $SUITE token.** Credits = SUITE. That's the currency.

---

## The Mission

**Goal:** Create 1 novel, unique, revenue-focused app every day.

**App Lifecycle:**
```
Idea Generated → Community Votes (X/Twitter) → App Factory Builds → Listed → Earns Revenue → Hits $5,000 → LIVE business
```

---

## The Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  /ideagenerator │ →   │   X/Twitter     │ →   │   /appfactory   │ →   │   SUITE Shell   │
│                 │     │     Vote        │     │                 │     │                 │
│ • Research      │     │ • Post ideas    │     │ • Prompt wizard │     │ • Live app      │
│ • Generate ideas│     │ • Likes = votes │     │ • Stuart guides │     │ • Earns revenue │
│ • Novel concepts│     │ • Most liked    │     │ • Claude builds │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Voting = X/Twitter engagement.** Post ideas, most likes wins, that app gets built.

---

## /appfactory - Admin UI

**URL:** `getsuite.app/appfactory.html`

**Purpose:** Guided prompt wizard for building SUITE apps

**4-Step Workflow:**
1. **Define** - App name, slug, category, one-liner, core feature
2. **Features** - Free features, paid features (with credit costs)
3. **Build** - API needs, data model, main screens
4. **Deploy** - URL, icon, add to apps table

Each step generates a **copyable prompt** for Claude.

---

## Boilerplate

**Location:** `/boilerplate`

A minimal SUITE-ready app template:
- TelegramAuthContext (auth + credits)
- PaymentGate (monetization modal)
- Feature registry pattern
- Dark theme styling
- Ready for Expo Router

**To create a new app:**
```bash
cp -r boilerplate your-app-name
cd your-app-name
npm install
# Edit config/features.ts
npm run web
npm run build:web
vercel --prod
```

---

## Key Files

| File | Purpose |
|------|---------|
| `appfactory.html` | Admin UI page |
| `boilerplate/` | SUITE app template |
| `boilerplate/contexts/TelegramAuthContext.tsx` | Auth + credits |
| `boilerplate/components/PaymentGate.tsx` | Monetization |
| `boilerplate/config/features.ts` | Feature definitions |
| `sql/app-factory-schema.sql` | Project tracking table |

---

## Prompt Templates

### Step 1: Define
```
Create a new SUITE ecosystem app:
- Name: {appName}
- Slug: {slug}
- Category: {category}
- Description: {oneLiner}
- Core Feature: {coreFeature}

Use the SUITE App Boilerplate at /boilerplate.
```

### Step 2: Features
```
Add these features to {appName}:

FREE FEATURES:
{freeFeatures}

PAID FEATURES:
{paidFeatures}

Update config/features.ts with the feature registry.
```

### Step 3: Build
```
Implement the core functionality:
- API: {apiNeeded}
- Data Model: {dataModel}
- Screens: {mainScreens}

Follow FoodVitals patterns (services/*.ts, PaymentGate, etc.)
```

### Step 4: Deploy
```
Deploy to production:
1. npm run build:web
2. vercel --prod
3. Add to apps table in Supabase
4. Test in SUITE Shell
```

---

## Build Tool

**Claude terminals** - not Antigravity/watcher.py

Workflow:
1. App Factory UI → generates prompt
2. Stuart copies prompt → pastes to Claude Code terminal
3. Claude builds using boilerplate
4. Repeat for each step

---

## Database

**Table:** `app_factory_projects`
- Tracks project progress through steps
- Stores config from each step
- Links to final deployed app

**Storage:** Currently uses localStorage in the UI, can sync to Supabase.

---

## Verification

1. Go to `getsuite.app/appfactory.html`
2. Click "New App"
3. Fill in Step 1 fields
4. Copy generated prompt
5. Paste to Claude terminal
6. Continue through all steps
7. App appears in SUITE Shell
