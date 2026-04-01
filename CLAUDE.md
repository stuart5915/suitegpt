# SUITE Website - Claude Code Instructions

## Project Overview
This is the SUITE ecosystem website (getsuite.app), hosted on Vercel with auto-deploy on git push.

---

## /system Command

Quick reference for SUITE's implemented systems. Data stored in `systems.json`.

### Usage
- `/system` → List all available systems
- `/system [name]` → Get full context for a specific system (e.g., `/system yield-rewards`)
- `/system add` → Add a new system definition

### When user types `/system`:
1. Read `systems.json` from project root
2. If no argument: list all systems with name + summary
3. If argument provided: output the full description, files, tables, and notes for that system
4. If "add": prompt user for name, summary, description, related files/tables, then save to systems.json

### Current Systems (auto-updated):
- `yield-rewards` - User deposits earn yield, distributed to shared reward pool
- `credits` - Credits for app usage, stored in Supabase
- `suite-shell` - Single container that loads all SUITE apps in iframe
- `apps-table` - Supabase table storing all SUITE ecosystem apps
- `cross-domain-auth` - Pass auth tokens between suitegpt.app and external app iframes

---

## /ceo Command

Inclawbate CEO co-pilot. Reads context files, assesses current state, and guides what to work on next.

### When user types `/ceo`:
1. Read `CEO.md` (vision, decision framework, current state)
2. Read `CEO_TASKS.md` (full prioritized backlog)
3. Read `COUNCIL.md` and `COUNCIL_MEMBERS.md` (council governance + member activity)
4. Fetch live team state: `WebFetch GET https://www.inclawbate.app/api/inclawbate/team-state` — this returns the **actual** Past/Present/Future items from the daily post (managed via Telegram bot). Compare this with CEO_TASKS.md to find gaps.
5. Assess current state:
   - What's in Present (actively being worked on)?
   - What's in Future (queued up)?
   - Does Present/Future align with the priority backlog in CEO_TASKS.md?
   - Any P0/P1 tasks missing from Present/Future?
   - Any deadlines approaching?
6. Recommend the **top 1-3 things to work on right now**, with reasoning based on the decision framework (revenue > user issues > growth > stickiness > marketing > partnerships > nice-to-haves)
7. If Present/Future needs updating, suggest specific Telegram commands: `/add [task]`, `/done [number]`, `/current [number]`
8. Ask: "Want to dive into one of these, or is something else on your mind?"

### When user says "idk what to do" or similar:
- Run the `/ceo` flow above
- Be decisive — pick THE one thing and explain why
- If multiple things are equal priority, pick whichever can ship fastest
- Always check live team state to avoid recommending something already in Present

### When a task is completed:
- Update `CEO_TASKS.md` — move to "Recently Completed" with date
- Suggest what's next

### When user adds a new task:
- Add it to `CEO_TASKS.md` with appropriate priority tier
- Explain where it fits relative to other priorities

---

### `/ceo refresh` — The Deep Analysis Engine

This is the most important command in the system. It regenerates the entire task queue by analyzing everything — code, state, history, team, gaps — and produces a prioritized stream of specific, ready-to-execute tasks. Run this whenever the task list feels stale, when you finish a batch of work, or when you need direction.

**Philosophy:** The hard part isn't doing the work — it's knowing what to do next. This command solves that. It thinks like a CEO who can read every line of code.

#### Phase 1: GATHER — Read the Full State

Run all of these in parallel:

**Context files:**
- Read `CEO.md` — vision, decision framework, revenue streams, current state
- Read `CEO_TASKS.md` — full backlog with priorities and completion history
- Read `COUNCIL.md` — governance framework, treasury, allocation targets
- Read `COUNCIL_MEMBERS.md` — who's doing what, weekly cadence
- Read any `initiative_*.md` and `project_*.md` files in root — active initiatives

**Live state:**
- `WebFetch GET https://www.inclawbate.app/api/inclawbate/team-state` — actual Present/Future from Telegram bot
- `git log --oneline -40` — what shipped recently (look for patterns, velocity, what areas got attention)
- `git log --oneline --since="2 weeks ago"` — focus window for recent activity

**Codebase scan (use Explore agents in parallel):**
- Scan `api/inclawbate/` for: TODO/FIXME/HACK comments, endpoints with missing error handling, half-implemented features, disabled code blocks
- Scan `inclawbate/` HTML files for: broken links, missing mobile responsiveness, placeholder content, features that reference APIs that don't exist
- Scan `pokerai/server/` for: TODOs, error handling gaps, features referenced in MEMORY but not yet live
- Check `supabase/migrations/` — any migrations created but potentially not applied to production?
- Check for new untracked files (`git status`) that might indicate work-in-progress

#### Phase 2: DISCOVER — Find What the Task List Is Missing

Cross-reference everything gathered to find gaps. Look for:

1. **Done but not marked done** — Tasks in CEO_TASKS.md that are clearly complete based on git history or code state. Mark them done and move to Recently Completed.

2. **Broken and not tracked** — Bugs, errors, or regressions visible in the code that have no corresponding task. Especially:
   - API endpoints that return generic errors instead of helpful messages
   - Features that work on desktop but not mobile
   - Flows that are partially built (UI exists but API doesn't, or vice versa)
   - Stale data (hardcoded values, outdated dates, wrong URLs)

3. **Almost done — needs a push** — Features that are 80%+ complete. These are the highest-ROI tasks because small effort yields a complete feature. Look for:
   - APIs that exist but have no UI calling them
   - UI that exists but points to placeholder data
   - Migrations created but not applied
   - Config/env vars defined but services not updated

4. **Quick wins** — Changes that take < 30 minutes but meaningfully improve the product:
   - Missing error messages that leave users confused
   - UI copy that's unclear or placeholder
   - Pages missing meta/OG tags (hurts sharing)
   - Dead links or references to removed features

5. **Strategic gaps** — Things NOT in the code or task list that should be, based on the vision and decision framework:
   - Revenue streams that are "Planned" but have zero code started
   - User-facing pages with no analytics or tracking
   - Features the council needs but doesn't have
   - Competitive threats or opportunities visible from the codebase structure

6. **Deadline risks** — Tasks with dates approaching. Calculate days remaining and flag anything within 14 days.

7. **Stale state** — Files that reference dates, numbers, or states that are outdated. CEO.md "Current State" section, COUNCIL_MEMBERS.md weekly cadence, any hardcoded dates.

#### Phase 3: PRIORITIZE — Apply the Decision Framework

Score every discovered task against the 7-tier framework. For each task, determine:

- **Framework tier** (1-7): Which priority level does this serve?
  1. Revenue generators
  2. Active user issues
  3. Growth levers
  4. Platform stickiness
  5. Marketing
  6. Partnerships
  7. Nice-to-haves

- **Scope**: S (< 30 min), M (1-2 hours), L (half day+)

- **Impact/effort ratio**: Prefer high-impact, low-effort. A 30-minute fix that unblocks revenue beats a half-day feature that's nice-to-have.

- **Dependencies**: Does this block other tasks? Is it blocked by anything?

- **Urgency multiplier**: Deadlines, user-reported issues, and broken production features get priority boost regardless of tier.

**Sorting rules:**
1. Any production bug or broken feature → top of list regardless of tier
2. Deadline within 7 days → P0 automatically
3. Deadline within 14 days → P1 minimum
4. Within same tier, prefer smaller scope (ship faster, build momentum)
5. Tasks that unblock other tasks get priority boost
6. "Almost done" features get priority boost (finish what you started)

#### Phase 4: GENERATE — Create the Executable Task Queue

For each task, generate this format in CEO_TASKS.md:

```
| # | Task | Status | Scope | Why it matters |
```

Additionally, for the **top 5 tasks**, generate a **ready-to-paste prompt** — the exact words Stuart should type into a new Claude Code session to execute that task. Each prompt should:

- Be self-contained (Claude Code can execute it with no prior context)
- Reference specific files, endpoints, or features by name
- Define clear success criteria (what "done" looks like)
- Be scoped to finish in a single session
- NOT require any external services, paid APIs, or manual steps that Claude can't do

**Prompt format:**
```
## Task [#]: [Title]
**Scope:** S/M/L | **Framework tier:** [1-7] [tier name]
**Why now:** [1 sentence — why this specific task, right now, over everything else]

### Prompt:
> [The exact instruction to paste into Claude Code]

### Done when:
- [Specific, verifiable completion criteria]
```

#### Phase 5: UPDATE — Write Everything Back

After analysis, update these files:

1. **CEO_TASKS.md:**
   - Move confirmed-complete tasks to "Recently Completed" with today's date
   - Add newly discovered tasks with appropriate priority
   - Re-sort tasks within each tier by impact/effort ratio
   - Remove or archive tasks that are no longer relevant
   - Add `Scope` column to tables (S/M/L)

2. **CEO.md** — "Current State" section:
   - Update "Last updated" to today's date
   - Update active users, apps published, staking status, biggest friction, next milestone
   - Update revenue streams table if any status changed

3. **COUNCIL_MEMBERS.md** — If more than 5 days stale:
   - Roll over weekly cadence (archive old week, start new)
   - Move In Progress items that are done based on git log
   - Note any members who haven't had activity logged

#### Phase 6: OUTPUT — Present to Stuart

Output to the terminal (this is what Stuart sees):

```
# Inclawbate Refresh — [today's date]

## State of things
- [3-5 bullet summary: what's live, what shipped recently, what's broken, what's approaching]

## What changed since last refresh
- [Tasks marked done]
- [New tasks discovered]
- [Priority shifts]

## Your top 3 right now:

### 1. [Task title] (Scope: S/M/L)
[1-2 sentences: why this, why now]
> Prompt: [the exact words to paste]

### 2. [Task title] (Scope: S/M/L)
[1-2 sentences]
> Prompt: [exact words]

### 3. [Task title] (Scope: S/M/L)
[1-2 sentences]
> Prompt: [exact words]

---
Full backlog updated in CEO_TASKS.md ([X] tasks total, [Y] new, [Z] completed)
Pick a number or tell me what's on your mind.
```

#### Why This Gets Better Over Time

Each refresh cycle feeds the next:
- **Recently Completed grows** → patterns emerge (what areas get attention, what gets neglected, what ships fast vs slow)
- **Git history deepens** → better understanding of real velocity and common fix patterns
- **Discovered tasks accumulate** → fewer blind spots each cycle
- **State files stay current** → each refresh starts from accurate baseline, not stale assumptions
- **Scope estimates calibrate** → comparing estimated vs actual scope improves future estimates

The system never needs external services, paid APIs, or running processes. It's just Stuart + Claude Code + the codebase + these files. The "engine" is the quality of the analysis, and the analysis gets better because the data gets richer.

---

## /council Command

Manage the CLAWS Council — members, activity, decisions, and weekly cadence. Data stored in `COUNCIL.md` (governance framework) and `COUNCIL_MEMBERS.md` (dynamic member/activity data).

### When user types `/council`:
1. Read `COUNCIL.md` and `COUNCIL_MEMBERS.md`
2. Output a summary: active members, what each is working on, current week's Done/In Progress/Planned
3. Ask: "Need to update anything?"

### `/council status` — Weekly Cadence Report
1. Read `COUNCIL_MEMBERS.md`
2. Output formatted report:
   - **Done** — what was completed last week
   - **In Progress** — what's being worked on now
   - **Planned** — what's coming next
   - **Per-member status** — what each council member is doing
3. This is copy-pasteable into the Telegram council group

### `/council add [name]` — Add a New Member
1. Ask for: wallet address, X handle, roles/skills, current work
2. Add to the Active Members section in `COUNCIL_MEMBERS.md`
3. Update the member table in `COUNCIL.md`

### `/council update [name]` — Update a Member
1. Read current member info from `COUNCIL_MEMBERS.md`
2. Apply the update (new role, current work, completed items, status change)
3. Save changes

### `/council task [name] [task description]` — Assign/Log a Task
1. Add task to member's "Currently working on" in `COUNCIL_MEMBERS.md`
2. Add to "In Progress" in the current week's cadence section

### `/council done [description]` — Log Something as Completed
1. Move item from "In Progress" to "Done" in current week's cadence
2. Update relevant member's "Recently completed"

### `/council decide [description]` — Log a Decision
1. Add to the Decisions Log table with date, description, and who decided

### `/council week` — Start a New Week
1. Archive the current week's cadence (move to a "Past Weeks" section or trim)
2. Create a new "Week of [date]" section
3. Roll over any unfinished "In Progress" items
4. Prompt: "What's planned for this week?"

### `/council propose [description]` — Add a Proposal
1. Add to the Proposals (Pending) section in `COUNCIL_MEMBERS.md`

### When user pastes Telegram messages about council activity:
- Parse what happened (who said what, any commitments, any decisions)
- Suggest updates to `COUNCIL_MEMBERS.md`
- Apply after user confirms

---

## /publish-article Command

When you receive a `/publish-article` prompt (from the publish daemon or manually), follow these steps:

### Input Format
```
/publish-article

Title: [Article Title]
Tags: [comma, separated, tags]
Destination: learn (or docs, blog)

---

[Article content - plain text or markdown]

---

Content ID for status update: [uuid] (optional, for daemon)
```

### Processing Steps

1. **Generate slug** from title
   - Lowercase, replace spaces with hyphens
   - Example: "How AI Fleet Works" → "how-ai-fleet-works"

2. **Format as HTML**
   - Use the article template style from `/learn/ai-fleet.html`
   - Add proper meta tags for SEO
   - Add Open Graph tags for social sharing

3. **Generate cover image** (if Gemini available)
   - Use Gemini API to generate a cover image
   - Save to `/assets/articles/[slug]-cover.png`
   - If Gemini unavailable, use a gradient placeholder or skip

4. **Create article file**
   - Save to `/learn/[slug].html`
   - Match the style of existing articles

5. **Update articles listing**
   - Add new article card to `/learn/articles.html`
   - Put newest articles at the top

6. **Commit and push**
   ```bash
   git add .
   git commit -m "Add article: [Title]"
   git push
   ```

7. **Report success**
   - Output the published URL: `https://getsuite.app/learn/[slug].html`
   - Output the cover image path (if generated)

---

## Article Template Reference

Use this structure for new articles (based on existing `/learn/ai-fleet.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Title] | SUITE</title>
    <meta name="description" content="[Summary/first paragraph]">

    <!-- Open Graph -->
    <meta property="og:title" content="[Title]">
    <meta property="og:description" content="[Summary]">
    <meta property="og:image" content="https://getsuite.app/assets/articles/[slug]-cover.png">
    <meta property="og:url" content="https://getsuite.app/learn/[slug].html">

    <link rel="icon" type="image/png" href="/assets/suite-logo-new.png">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/suite-styles.css">
    <link rel="stylesheet" href="/nav.css">
    <!-- Article styles -->
</head>
<body>
    <nav id="main-nav"></nav>
    <script src="/nav-component.js"></script>

    <article class="article-container">
        <a href="articles.html" class="back-link">← Back to Articles</a>

        <header class="article-header">
            <div class="article-tags">[Tags as badges]</div>
            <h1>[Title]</h1>
            <p class="article-meta">📅 [Date] · ⏱️ [X] min read</p>
        </header>

        <div class="article-content">
            [Formatted content with proper headings, paragraphs, etc.]
        </div>
    </article>

    <footer class="footer">
        <p>© 2026 SUITE. Anyone Can Build. Everyone Gets Paid.</p>
    </footer>
</body>
</html>
```

---

## Supabase Integration

If a Content ID is provided, update the status in Supabase after publishing:

```javascript
// The daemon handles this, but if manual:
supabase.table('content_queue')
    .update({
        status: 'published',
        published_url: 'https://getsuite.app/learn/[slug].html',
        published_at: new Date().toISOString()
    })
    .eq('id', contentId)
```

---

## File Structure

```
/learn/
  ├── articles.html      ← Article listing page
  ├── ai-fleet.html      ← Existing article
  ├── yield-powered-app.html
  └── [new-articles].html

/assets/articles/        ← Article cover images
  └── [slug]-cover.png

/scripts/
  └── publish-daemon.py  ← Polls Supabase, triggers Claude
```

---

## Testing

To test the publish flow manually:
```
/publish-article

Title: Test Article
Tags: test, demo
Destination: learn

---

This is a test article to verify the publishing pipeline works correctly.

## Section 1
Some content here.

## Section 2
More content here.
```
