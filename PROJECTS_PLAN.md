# Add "Your Projects" to Dashboard

## Context
Inclawbate is evolving from scattered pages (agents, tokens, apps, stake) into a project-centric incubation platform. A "project" bundles a builder's app + token + stake pool + socials into one entity. This is the first step: add a "Your Projects" section to the dashboard where builders can create and manage projects by linking their existing assets together. No pages are removed — this is additive only.

## Files to Create

### 1. `supabase/migrations/20260307000000_projects.sql` ✅ DONE
New `projects` table:
```sql
CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_wallet text NOT NULL,
    creator_profile_id uuid,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    description text,
    logo_url text,
    app_id uuid,
    app_slug text,
    token_address text,
    staking_address text,
    x_handle text,
    telegram_url text,
    website_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_projects_creator ON projects(creator_wallet);
```
- No foreign keys — loose references so nothing breaks if app/token deleted
- All link fields nullable — assemble project piece by piece
- Separate from `inclawbator_projects` (which stays untouched)

### 2. `api/inclawbate/projects.js` ✅ DONE
CRUD API following `inclawbator.js` patterns:
- **GET** `?wallet=0x...` → list user's projects ordered by `created_at DESC`
- **POST** → create project (JWT auth via `authenticateRequest` from `x-callback.js`)
  - Generate slug from name, handle collisions with `-2`, `-3` suffix
  - Set `creator_wallet` from authenticated profile
- **PUT** → update project (JWT auth, verify ownership by `creator_wallet`)
- CORS: allow `inclawbate.app`, `www.inclawbate.app`, `localhost:3000`, `localhost:5500`
- Supabase client with `SUPABASE_SERVICE_ROLE_KEY`

## Files to Modify

### 3. `inclawbate/dashboard.html` — TODO
Insert new section **after** the Tools grid (line 208) and **before** My Apps (line 209):
```html
<div class="overview-section" id="overviewProjects">
    <div class="overview-section-header">
        <h3>Your Projects</h3>
        <button type="button" class="overview-section-action" id="createProjectBtn">+ Create Project</button>
    </div>
    <div id="projectsList">
        <div class="overview-empty"><p>No projects yet. Bundle your app, token, and socials into one project.</p></div>
    </div>
</div>
```
- Style the button with existing `.overview-section-action` pattern but as a `<button>` not `<a>`
- Add minimal CSS for project cards (reuse `.project-card` pattern from My Tokens section)

### 4. `inclawbate/js/dashboard-app.js` — TODO
Add these new functions (following existing patterns):

**`loadUserProjects()`** — fetch from `GET /api/inclawbate/projects?wallet=...`, render cards into `#projectsList`. Called in `init()` alongside `loadOverview()`, `loadProjects()`, etc.

**`renderUserProjectCard(p)`** — renders a card showing:
- Project name + description
- Meta chips: app slug, token address (shortened), pool indicator, X handle
- Action buttons: Edit, Open App (if linked), BaseScan (if token), Website

**`openCreateProjectModal(existingProject)`** — dynamic modal (same pattern as `openFundModal` / `openEditApplicationModal`):
- Project Name (text input, required)
- Description (textarea)
- Link an App (dropdown of user's apps from cached `loadOverview` data)
- Token Address (text input, with clickable suggestions from user's `inclawbator_projects` tokens)
- Staking Pool (auto-detected when token matches an inclawbator_projects entry)
- X Handle (text input)
- Website (text input)
- Save button → POST or PUT depending on create/edit mode
- On success → refresh `loadUserProjects()`, close modal

**Cache user data for modal dropdowns:**
- Store `_cachedUserApps` from `loadOverview()` response
- Store `_cachedTokens` from `loadProjects()` response
- Modal reads these to populate app dropdown and token suggestions

**Wire create button:**
- `#createProjectBtn` click → check auth → `openCreateProjectModal(null)`
- Edit buttons on cards → `openCreateProjectModal(project)`

## What We're NOT Building Yet
- Project detail page (`/projects/[slug]`) — Phase 2
- AI tools on the project page — Phase 2
- Public project discovery / Explore page — Phase 3
- Nav changes — Phase 3
- Removing any existing pages — not until new stuff is proven

## Implementation Order
1. Migration SQL (safe, standalone) ✅
2. API endpoint (safe, nothing depends on it) ✅
3. Dashboard HTML (additive, just a new div)
4. Dashboard JS (new functions + one init call)
5. Run migration on Supabase

## Verification
1. Go to `inclawbate.app/dashboard`, connect wallet
2. See "Your Projects" section with empty state message
3. Click "+ Create Project" → modal opens
4. Fill in project name, select an app from dropdown, paste a token address
5. Save → card appears showing name + linked app + token
6. Click Edit → modal opens pre-filled, change description → save → card updates
7. Refresh page → projects persist (loaded from Supabase)
8. Mobile: modal and cards render properly on small screens
