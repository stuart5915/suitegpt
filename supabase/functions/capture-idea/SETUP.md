# Telegram Idea Capture Bot - Setup Guide

## 1. Create the Database Table

Run the SQL in `sql/personal-ideas-schema.sql` in your Supabase SQL editor.

## 2. Create Telegram Bot

1. Open Telegram and message **@BotFather**
2. Send `/newbot`
3. Name your bot (e.g., "Stuart Ideas Bot")
4. Choose a username (e.g., `stuart_ideas_bot`)
5. Copy the **bot token** - you'll need it

## 3. Set Environment Variables

In your Supabase project dashboard, go to **Settings > Edge Functions** and add these secrets:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
```

Get a Gemini API key at: https://aistudio.google.com/app/apikey

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available.

## 4. Deploy the Edge Function

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref rdsmdywbdiskxknluiym

# Deploy the function
supabase functions deploy capture-idea
```

## 5. Set Telegram Webhook

After deploying, set the webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://rdsmdywbdiskxknluiym.supabase.co/functions/v1/capture-idea"}'
```

Or use this URL in your browser:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://rdsmdywbdiskxknluiym.supabase.co/functions/v1/capture-idea
```

## 6. Test It

1. Open your Telegram bot
2. Send a message like: "Add dark mode to FoodVitals and check out that new DeFi protocol"
3. Bot should reply with captured items
4. Check the Ideas tab in AppFactory to see them

## Optional Commands

You can use direct commands to skip AI categorization:

- `/app Your app idea` - Force categorize as app_idea
- `/suite Feature request` - Force categorize as suite_feature
- `/article Blog post idea` - Force categorize as article
- `/life Personal reminder` - Force categorize as personal
- `/action To-do item` - Force categorize as action_item
- `/question Research topic` - Force categorize as question
- `/brainstorm Rough idea` - Force categorize as brainstorm
- `/business SUITE business idea` - Force categorize as suite_business

## Troubleshooting

**Bot not responding?**
- Check Supabase Edge Function logs
- Verify webhook is set correctly: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

**Items not appearing in Kanban?**
- Check Supabase table has entries
- Verify RLS policies allow read access

**AI categorization failing?**
- Check `GEMINI_API_KEY` is set correctly
- Check Edge Function logs for errors
- Gemini free tier: 15 requests/minute, 1500/day
