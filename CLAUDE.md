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
4. Fetch live team state: `WebFetch GET https://www.inclawbate.com/api/inclawbate/team-state` — this returns the **actual** Past/Present/Future items from the daily post (managed via Telegram bot). Compare this with CEO_TASKS.md to find gaps.
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
