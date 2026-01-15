# WorkConductor

> Your Personal AI Work Session Manager

WorkConductor uses Gemini AI to analyze your project goals and create strategic work session plans. Get detailed, actionable steps with exact prompts to send to your AI coding assistant.

## Features

- **Strategic Session Planning**: Gemini 2.5 Pro analyzes your goals and recent work to create focused 30min-2hr work plans
- **Copy-Paste Prompts**: Each task includes exact prompts to send to Antigravity
- **Feedback Loop**: When things don't work, the AI defends its reasoning or adapts based on your feedback
- **Rate Limit Tracking**: Visual display of remaining API calls with countdown timers
- **Session History**: Track your completed sessions and build context over time

## Setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open `work-conductor/index.html` in your browser (or deploy to Vercel)
3. Enter your API key and your goals/telos
4. Click "Start Work Session" to get your first strategic plan!

## API Usage (Free Tier)

| Model | Use | Rate Limit |
|-------|-----|------------|
| Gemini 2.5 Pro | Session planning | 5/min, 100/day |
| Gemini 3 Flash | Quick feedback | 10/min, 100/day |

## Files

- `index.html` - Main app structure
- `styles.css` - Premium dark theme styling
- `app.js` - Main application logic
- `gemini-client.js` - Gemini API wrapper with rate limiting
- `supabase-client.js` - Persistence layer
- `session-ui.js` - UI components for sessions
- `manifest.json` - PWA manifest

## Deployment

The app is a static PWA that can be deployed anywhere:

```bash
# Deploy to Vercel (from project root)
vercel --prod
```

It will be available at `your-domain.com/work-conductor/`

## Database Schema (Optional)

If you want full persistence, create these tables in Supabase:

```sql
-- Store user's goals and telos
CREATE TABLE conductor_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store work sessions
CREATE TABLE conductor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    session_plan JSONB,
    focus TEXT,
    status TEXT DEFAULT 'active',
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store feedback for learning
CREATE TABLE conductor_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id UUID REFERENCES conductor_sessions(id),
    feedback_type TEXT,
    details TEXT,
    ai_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

The app works without these tables (uses localStorage), but Supabase enables cross-device sync.
