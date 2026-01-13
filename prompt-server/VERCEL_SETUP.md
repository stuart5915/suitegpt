# Vercel Auto-Deploy Setup Guide

## Prerequisites
- Vercel account (sign up at https://vercel.com)
- Access token from Vercel

## Step 1: Get Your Vercel Token

1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name like "SUITE Watcher Bot"
4. Set scope to "Full Account"
5. Copy the token (you won't see it again!)

## Step 2: Set Environment Variable

### On Windows (PC):
```powershell
# Open PowerShell as Administrator
setx VERCEL_TOKEN "your_token_here_paste_it"
```

### On Mac/Linux:
```bash
# Add to ~/.bashrc or ~/.zshrc
export VERCEL_TOKEN="your_token_here_paste_it"

# Then reload
source ~/.bashrc
```

## Step 3: Restart watcher.py

```bash
# Stop the current watcher.py (Ctrl+C)
# Then restart it
cd c:\Users\Stuart\stuart-hollinger-landing\prompt-server
python watcher.py
```

## Step 4: Test Deployment (Optional)

Test the deployment module manually:

```bash
cd c:\Users\Stuart\stuart-hollinger-landing\prompt-server

# Test with a simple app folder
python vercel_deployer.py "C:\path\to\app\folder" "Test App Name"
```

## How It Works

1. **Build completes** - When Antigravity finishes building an app, it writes `build_complete.json`
2. **Watcher detects** - `watcher.py` detects the completion file
3. **Auto-deploy** - `vercel_deployer.py` uploads all files to Vercel via API
4. **Get URL** - Waits for deployment to complete and gets production URL
5. **Update database** - Updates Supabase `suite_apps.download_url` with the URL
6. **Live!** - App is now accessible at `https://app-name.vercel.app`

## Troubleshooting

### "VERCEL_TOKEN environment variable not set"
- Make sure you set the environment variable
- Restart PowerShell/Terminal after setting it
- Restart `watcher.py`

### "Deployment failed" 
- Check the watcher.py console for error details
- Verify your token is valid
- Check that the app folder exists

### "Failed to update URL in Supabase"
- Check that SUPABASE_SERVICE_KEY is set in watcher.py
- Verify the idea_id exists in the suite_apps table

## What Gets Deployed

All files in the app folder EXCEPT:
- `node_modules/`
-`.git/`
- `.next/`, `dist/`, `build/`
- `__pycache__/`
- `.DS_Store`, `.env*`, `*.log`

## Production URL Format

Apps are deployed to: `https://{app-name-slugified}.vercel.app`

Example:
- "Cheshbon Reflections" → `https://cheshbon-reflections.vercel.app`
- "TrueForm AI" → `https://trueform-ai.vercel.app`
