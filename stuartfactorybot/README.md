# StuartFactoryBot

Personal intake bot for capturing ideas via Telegram and routing them to Claude CLI.

## Flow

1. **Send a message** - "New article idea: exploring the nature of time"
2. **AI classifies** - Detects it's an article for ArtStu
3. **Confirm destination** - Bot asks if ArtStu is correct
4. **Answer questions** - Bot asks template questions (theme, audience, tone)
5. **Review prompt** - Bot shows the generated Claude prompt
6. **Approve** - Prompt goes to `claude_tasks` queue
7. **Execute** - Daemon on your PC runs the prompt via Claude CLI

## Setup

### 1. Create the bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Save the bot token

### 2. Run the SQL schema

Run `sql/stuartfactorybot-schema.sql` in your Supabase SQL editor to create:
- `intake_destinations` - Dynamic destinations (synced with NoteBox)
- `intake_conversations` - Conversation state tracking

### 3. Deploy to Vercel

```bash
cd stuartfactorybot
npm install
vercel
```

### 4. Set environment variables in Vercel

- `TELEGRAM_BOT_TOKEN` - From BotFather
- `SUPABASE_URL` - Your Supabase URL
- `SUPABASE_SERVICE_KEY` - Service role key (not anon!)
- `GEMINI_API_KEY` - FREE! Get at https://aistudio.google.com/app/apikey
- `ALLOWED_USER_IDS` - Your Telegram user ID (comma-separated for multiple)

### 5. Set the webhook

```bash
TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL=https://your-app.vercel.app/api/webhook node scripts/set-webhook.js
```

### 6. Get your Telegram user ID

Send `/start` to [@userinfobot](https://t.me/userinfobot) to get your ID.

## Commands

- `/start` - Welcome message
- `/cancel` - Cancel current conversation
- `/destinations` - List all available destinations

## Adding Destinations

Add new destinations directly in Supabase (`intake_destinations` table) or use the NoteBox UI. The bot will automatically pick them up.

Each destination has:
- **name**: Display name
- **slug**: Unique identifier
- **description**: Helps AI classify messages
- **keywords**: Words that suggest this destination
- **template_questions**: JSON array of questions to ask
- **prompt_template**: Template for the Claude prompt

## How it connects to Claude

When you approve a prompt, it creates a row in `claude_tasks`. The `scripts/claude-watcher.js` daemon running on your PC polls this table and executes prompts via Claude CLI.

Make sure the daemon is running:
```bash
node scripts/claude-watcher.js
```
