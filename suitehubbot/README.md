# SUITE Hub Bot

Telegram bot for the SUITE ecosystem. Handles:
- Wallet ↔ Telegram linking
- Community management (welcome new members)
- AI-powered Q&A about SUITE

## Features

### Wallet Linking
1. User connects wallet on getsuite.app
2. User clicks "Link Telegram"
3. Opens `t.me/suitehubbot?start=link_0x1234...`
4. Bot asks for confirmation
5. User clicks "Confirm"
6. User can now login via Telegram

### Community Commands
- `/help` - Show available commands
- `/apps` - Browse SUITE apps
- `/credits` - Learn about credits system
- `/governance` - How to participate in governance
- `/ask <question>` - AI-powered Q&A about SUITE

### Auto-Welcome
When added to a group, the bot welcomes new members with:
- Quick start links
- How to explore SUITE
- Command hints

## Setup

1. **Get your bot token** from [@BotFather](https://t.me/BotFather)

2. **Get your Gemini API key** (FREE) from [AI Studio](https://aistudio.google.com/app/apikey)

3. **Deploy to Vercel:**
   ```bash
   cd suitehubbot
   npm install
   vercel
   ```

4. **Set environment variables in Vercel:**
   - `TELEGRAM_BOT_TOKEN` - from BotFather
   - `SUPABASE_SERVICE_KEY` - from Supabase (service_role key)
   - `GEMINI_API_KEY` - from Google AI Studio
   - `WEBHOOK_URL` - your Vercel URL + `/api/webhook`

5. **Set the webhook:**
   ```bash
   TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL=https://your-app.vercel.app/api/webhook node scripts/set-webhook.js
   ```

## Adding to a Group

1. Add @suitehubbot to your Telegram group
2. Make it an admin (optional, for welcome messages)
3. Bot will automatically:
   - Welcome new members
   - Respond to commands
   - Answer questions containing "SUITE"
