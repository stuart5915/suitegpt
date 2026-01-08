# SUITE Hub Bot

A Gemini-powered Discord bot for processing community contributions and tracking SUITE rewards.

## Setup

1. **Create Discord Application**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to "Bot" section → Create bot → Copy token
   - Enable these Privileged Gateway Intents:
     - MESSAGE CONTENT INTENT
     - SERVER MEMBERS INTENT

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your tokens and channel IDs
   ```

3. **Install & Run**
   ```bash
   npm install
   npm start
   ```

## Bot Permissions

When inviting the bot, use this permission integer: `277025770560`

Or select these permissions:
- Read Messages/View Channels
- Send Messages
- Manage Messages
- Embed Links
- Add Reactions
- Read Message History
- Use Slash Commands

## Slash Commands

- `/leaderboard` - Show weekly top contributors
- `/mystats` - Check your SUITE earnings
- `/help` - How to earn SUITE

## Workflow

```
User posts in #submit-* → AI refines → #pending
Reviewer reacts ✅/❌ → #approved or deleted
Reviewer reacts 🚀 → #shipped + bonus SUITE
```
