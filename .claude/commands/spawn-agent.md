# Spawn Agent

Create a new autonomous agent in the SUITE ecosystem from the template.

## Input Format

The user will provide:
```
App Name: [Name]
App Slug: [slug]
Agent Slug: [agent-slug]
App Description: [description]
Agent Mission: [mission]
Agent Type: [app|content|hybrid]
```

## Steps to Execute

### 1. Validate Input
Ensure all required fields are provided:
- App Name (display name)
- App Slug (lowercase, hyphens only)
- Agent Slug (usually `{app-slug}-agent`)
- Agent Mission (one sentence)
- Agent Type (app, content, or hybrid)

### 2. Create Agent Directory
Copy the template folder to create the new agent:

```bash
# Create agent directory
cp -r agents/_template agents/{agent-slug}
```

### 3. Rename Template Files
Rename the template files to match the agent:
- `TEMPLATE_TELOS.md` → `{AGENT}_TELOS.md` (e.g., `FITCOACH_TELOS.md`)
- Update `CLAUDE.md` with agent-specific info

### 4. Replace Placeholders
In all files, replace these placeholders:
- `[agent-slug]` → actual agent slug
- `[app-slug]` → actual app slug
- `[APP_NAME]` → actual app name
- `[AGENT_NAME]` → actual agent name (derived from app name)
- `[AGENT]` → agent name in UPPERCASE

### 5. Update state.json
Edit `agents/{agent-slug}/state.json`:
```json
{
  "agent_id": "{agent-slug}",
  "owned_app": "{app-slug}",
  "created_at": "{current ISO timestamp}",
  ...
}
```

### 6. Set Up TELOS_SMALL.md
The TELOS_SMALL.md should be ready for the agent's first proposal:
- Status: `needs_proposal`
- All other fields empty/placeholder

### 7. Update integrations.json
Edit `agents/{agent-slug}/integrations.json`:
- Update agent_id
- Set appropriate default integrations based on agent type

### 8. Customize the Telos Document
Update `agents/{agent-slug}/{AGENT}_TELOS.md`:
- Fill in app description
- Set up initial placeholders for user to complete later
- Include the provided mission statement

### 9. Create Asset Placeholder
```bash
# Create .gitkeep in assets folder
echo "Agent avatar and assets go here" > agents/{agent-slug}/assets/.gitkeep
```

### 10. Commit Changes
```bash
git add agents/{agent-slug}
git commit -m "Spawn agent: {agent-slug}

- Created from _template
- Agent Type: {agent-type}
- App: {app-name}
- Mission: {mission}"
git push
```

## Output

After completion, report:
1. Files created (list them)
2. Agent directory path
3. Next steps for the user:
   - Review and customize `{AGENT}_TELOS.md`
   - Add agent avatar to `assets/`
   - Wake the agent to start the small telos proposal cycle

## Example

Input:
```
App Name: FitCoach
App Slug: fitcoach
Agent Slug: fitcoach-agent
App Description: AI-powered personal fitness coaching app
Agent Mission: Help users build sustainable workout habits through personalized guidance
Agent Type: app
```

Output:
```
✅ Agent spawned successfully!

Created files:
- agents/fitcoach-agent/CLAUDE.md
- agents/fitcoach-agent/FITCOACH_TELOS.md
- agents/fitcoach-agent/TELOS_SMALL.md
- agents/fitcoach-agent/state.json
- agents/fitcoach-agent/integrations.json
- agents/fitcoach-agent/assets/.gitkeep
- agents/fitcoach-agent/history/.gitkeep
- agents/fitcoach-agent/knowledge/.gitkeep
- agents/fitcoach-agent/work/.gitkeep

Agent Directory: agents/fitcoach-agent/

Next Steps:
1. Review and customize FITCOACH_TELOS.md with app details
2. Add an avatar image to agents/fitcoach-agent/assets/
3. Wake the agent from Factory to start its first small telos proposal
```

## Notes

- The agent will be in `needs_proposal` state after spawning
- First wake will trigger a small telos proposal
- Stuart must approve the first small telos before the agent starts working
- The agent is already registered in Supabase (done by UI before this command)
