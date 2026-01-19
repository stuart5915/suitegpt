# SUITE Hub Bot

Telegram bot for linking wallets to Telegram accounts.

## Setup

1. **Get your bot token** from [@BotFather](https://t.me/BotFather)

2. **Get your Supabase service key** from Dashboard > Settings > API

3. **Deploy to Vercel:**
   ```bash
   cd suitehubbot
   npm install
   vercel
   ```

4. **Set environment variables in Vercel:**
   - `TELEGRAM_BOT_TOKEN` - from BotFather
   - `SUPABASE_SERVICE_KEY` - from Supabase (service_role key)
   - `WEBHOOK_URL` - your Vercel URL + `/api/webhook`

5. **Set the webhook:**
   ```bash
   TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL=https://your-app.vercel.app/api/webhook node scripts/set-webhook.js
   ```

## How it works

1. User connects wallet on getsuite.app
2. User clicks "Link Telegram"
3. Opens `t.me/suitehubbot?start=link_0x1234...`
4. Bot asks for confirmation
5. User clicks "Confirm"
6. Bot updates `suite_credits.linked_telegram_id` in Supabase
7. User can now login via Telegram and access their credits
