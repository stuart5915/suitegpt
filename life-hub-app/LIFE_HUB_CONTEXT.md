# Stuart Hollinger App Ecosystem - Life Hub Context

This document provides all the context needed to build the Life Hub AI app that connects all Stuart's apps.

## 🤖 What is Life Hub?

Life Hub is a **personal AI assistant** that knows your life by connecting to all your other apps. It aggregates data from your workouts, nutrition, reflections, deals, and more into ONE brain that can answer personalized questions.

---

## 📱 The 11-App Portfolio

| # | App Name | Category | Primary Function | Data It Sends to Life Hub |
|---|----------|----------|------------------|---------------------------|
| 1 | **TrueForm AI (Physio)** | Health AI | AI-powered analysis of physiotherapy reports | Exercise completions, pain levels, body parts worked, progress |
| 2 | **OpticRep** | Fitness AI | AI personal trainer tracking movement and reps | Workout logs, rep counts, exercises performed, form scores |
| 3 | **FoodVital** | Nutrition AI | AI food scanner and nutrition logging | Foods logged, calories, macros, meal times, nutrition goals |
| 4 | **Cheshbon (Bible Social)** | Faith/Social | Scripture-centered social reflection | Bible reflections, verses read, spiritual insights, reading streaks |
| 5 | **REMcast (Dream Journal)** | Wellness | Recording and exploring dream patterns | Dream logs, themes, AI-generated interpretations |
| 6 | **ASMR Objects** | Physical Product | Unique tactile/sensory objects | Purchase history (minimal data) |
| 7 | **3D Mini-Me** | Physical Product | 3D printed models of users | Order history (minimal data) |
| 8 | **Deals** | Local/Utility | Marketplace tracker for local deals | Saved searches, alerts triggered, items viewed |
| 9 | **Cadence AI (Marketing)** | Business Tools | AI-powered content command center | Content created, posts scheduled, engagement metrics |
| 10 | **DeFi Hub** | Crypto/Education | DeFi learning and $SUITE management | Portfolio data, staking positions, learning progress |
| 11 | **Life Hub** | AI Central Hub | THIS APP - The brain that queries all the above | N/A - This is the reader |

---

## 🏗️ Architecture

### Shared Supabase "Life Memory" Database

Each app sends summaries to a SHARED Supabase database. Life Hub reads from it.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ TrueForm AI │  │  FoodVital  │  │  Cheshbon   │  ... (all apps)
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              sendToLifeHub(data)
                        │
                        ▼
              ┌─────────────────┐
              │  SHARED SUPABASE │
              │  life_memories   │
              │  (pgvector DB)   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   LIFE HUB APP  │
              │   (This App!)   │
              └─────────────────┘
```

### Supabase Schema

```sql
-- Memories from all apps
CREATE TABLE life_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  source_app TEXT NOT NULL, -- 'trueform', 'foodvital', 'cheshbon', etc.
  event_type TEXT NOT NULL, -- 'workout_complete', 'food_logged', 'reflection_saved'
  content TEXT NOT NULL, -- Human readable summary
  metadata JSONB, -- Structured data
  embedding VECTOR(1536), -- For semantic search
  created_at TIMESTAMP DEFAULT now()
);

-- Usage logs for $SUITE payments
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query TEXT NOT NULL,
  suite_cost DECIMAL(10,4),
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 💡 Example Life Hub Queries

Users can ask:

- "What's my life looking like this week?" 
  → Aggregates workouts, meals, reflections, deals saved

- "When am I most productive?"
  → Analyzes patterns across all apps

- "How has my shoulder pain correlated with my workouts?"
  → Cross-references TrueForm pain logs with OpticRep workout logs

- "Give me a plan for tomorrow"
  → Suggests workouts, meals, content to create based on history

---

## 🪙 $SUITE Token Integration

Life Hub uses $SUITE tokens for AI queries:
- **Simple queries**: Free (basic lookups)
- **Deep Life Queries**: Cost 0.01-0.05 $SUITE per query
- **$SUITE wallet** is built into the app

---

## 🎨 Design Aesthetic

From the original spec:
- **Style**: "Industrial Surrealism" - Dark mode with energetic accents
- **Colors**: Neon Cyan / Electric Purple on dark background
- **UI**: Chat interface similar to ChatGPT app
- **Navigation**: Bottom tabs - Home | Chat | Wallet | Settings

---

## 📋 Technical Stack

- **Frontend**: Expo (React Native) with TypeScript
- **Backend**: Supabase (PostgreSQL + pgvector for embeddings)
- **AI**: OpenAI/Anthropic API with RAG (retrieval-augmented generation)
- **Auth**: Supabase Auth (shared across all apps)
- **Blockchain**: Base (Ethereum L2) for $SUITE token

---

## 🔗 Helper SDK for Other Apps

Each existing app gets this small helper added:

```typescript
// lib/lifehub.ts
import { createClient } from '@supabase/supabase-js';

const lifeHubClient = createClient(
  process.env.LIFEHUB_SUPABASE_URL!,
  process.env.LIFEHUB_SUPABASE_ANON_KEY!
);

export async function logToLifeHub({
  userId,
  source,
  type,
  content,
  metadata
}: {
  userId: string;
  source: string;
  type: string;
  content: string;
  metadata?: Record<string, any>;
}) {
  return lifeHubClient.from('life_memories').insert({
    user_id: userId,
    source_app: source,
    event_type: type,
    content,
    metadata,
    created_at: new Date().toISOString()
  });
}
```

Usage in each app:
```typescript
// In TrueForm after workout completion:
await logToLifeHub({
  userId: user.id,
  source: 'trueform',
  type: 'workout_complete',
  content: 'Completed 30 min shoulder rehab. Pain level 3/10.',
  metadata: { bodyPart: 'shoulder', duration: 30, painLevel: 3 }
});
```

---

## 🚀 Next Steps

1. Set up the shared Supabase project for Life Hub
2. Create the Expo app with chat UI
3. Implement RAG-based AI queries
4. Build the $SUITE wallet integration
5. Create the helper SDK and add to other apps
