---
description: Checklist for publishing Expo apps as PWAs via /publish-app
---

# PWA Publishing Checklist

Before running `/publish-app`, ensure the app is ready for web deployment:

## 1. Supabase Configuration (if app uses Supabase)

### In App Code (`services/supabase.ts` or similar):
```typescript
// Add hardcoded fallbacks for web builds where Constants.expoConfig may not be available
const FALLBACK_SUPABASE_URL = 'https://your-project.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'your-anon-key';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl 
  || process.env.EXPO_PUBLIC_SUPABASE_URL 
  || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey 
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY 
  || FALLBACK_SUPABASE_ANON_KEY;
```

## 2. OAuth Redirect URL (if app uses Google/OAuth sign-in)

### In AuthContext or auth code:
```typescript
// Use window.location.origin for web, NOT makeRedirectUri()
const redirectUrl = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app')
  : 'yourapp://auth/callback';
```

### In Supabase Dashboard:
1. Go to **Authentication** → **URL Configuration**
2. Add production URL to **Redirect URLs**: `https://your-app.vercel.app`

## 3. After Deployment

### Vercel Deployment Protection:
1. Go to Vercel project → **Settings** → **Deployment Protection**
2. Toggle **Vercel Authentication** to **OFF** for public access

## 4. App Store Database Update
The `/publish-app` command automatically:
- Builds the PWA with `npx expo export --platform web`
- Deploys to Vercel
- Adds entry to `apps` table with `pending` status
- Sends approval DM to Stuart

After approval, the app appears on `getsuite.app/apps.html`.

## Quick Reference Commands
```bash
# Manual build
npx expo export --platform web

# Manual deploy
vercel deploy dist --prod --yes

# Check Vercel projects
vercel ls
```
