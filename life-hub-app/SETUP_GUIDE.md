# Life Hub - Setup Guide

Follow these steps in order. Each section tells you exactly what to do.

---

## Step 1: Create a Supabase Project (5 minutes)

1. **Go to**: https://supabase.com
2. **Click** "Start your project" (green button)
3. **Sign up** with your GitHub account (easiest) or email
4. **Click** "New Project"
5. **Fill in**:
   - **Name**: `life-hub` (or whatever you want)
   - **Database Password**: Make one up and **SAVE IT SOMEWHERE** (you'll need it later)
   - **Region**: Pick the closest to you (e.g., `US East` for Ontario)
6. **Click** "Create new project" - wait 2 minutes for it to set up

---

## Step 2: Get Your Supabase Keys (2 minutes)

1. In your Supabase project, click **Settings** (gear icon) in the left sidebar
2. Click **API** under "Project Settings"
3. You'll see two boxes at the top:

**Copy these to your `.env` file:**

| What to find | What to paste in .env |
|--------------|----------------------|
| **Project URL** (looks like `https://abc123.supabase.co`) | `EXPO_PUBLIC_SUPABASE_URL` |
| **anon public** key (long string starting with `eyJ...`) | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

---

## Step 3: Create the Database Table (3 minutes)

1. In Supabase, click **SQL Editor** in the left sidebar
2. Click **+ New query**
3. Copy and paste this ENTIRE block:

```sql
-- Create the life_memories table
CREATE TABLE life_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  source_app TEXT NOT NULL,
  event_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT now()
);

-- Create the usage_logs table
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  query TEXT NOT NULL,
  suite_cost DECIMAL(10,4),
  created_at TIMESTAMP DEFAULT now()
);

-- Allow anyone to read (for now, we'll add auth later)
ALTER TABLE life_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON life_memories FOR ALL USING (true);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON usage_logs FOR ALL USING (true);
```

4. Click **Run** (or press Ctrl+Enter)
5. You should see "Success" ✅

---

## Step 4: Get Your OpenAI API Key (3 minutes)

1. **Go to**: https://platform.openai.com
2. **Sign up or log in** with your account
3. Click your profile icon (top right) → **API keys**
4. Click **Create new secret key**
5. **Name it**: `Life Hub`
6. **COPY THE KEY IMMEDIATELY** (you can only see it once!)
7. Paste it in your `.env` file as `EXPO_PUBLIC_OPENAI_API_KEY`

> ⚠️ **Important**: OpenAI requires adding billing info and putting $5+ credit to use the API

---

## Step 5: Restart the App

After adding all keys to `.env`:

1. Go to the terminal running `npm start`
2. Press `Ctrl+C` to stop it
3. Run `npm start` again
4. Scan QR code with Expo Go

---

## Your .env Should Look Like This:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-abc123...
```

---

## Need Help?

Tell me which step you're stuck on and I'll help!
