# Prompts Queue Folder

This folder contains **pending** prompts from the Discord bot's manual workflow.

## 📋 Workflow

1. **Discord bot writes new prompt** → `prompts/[app]_[timestamp]_[title].txt`
2. **User says "Process all prompts in the prompts folder"**
3. **AI reads, implements, commits changes**
4. **AI deletes the completed prompt file** ✅

## 🗑️ Auto-Cleanup

**Completed prompts are deleted** to keep this folder clean. History is preserved via:
- Git commit history
- Discord #approved channel
- Discord #shipped channel

## 📂 File Naming

Format: `{app}_{timestamp}_{title}.txt`
- `app`: e.g. "defiknowledge", "suite-hub"
- `timestamp`: Unix timestamp
- `title`: Sanitized title (30 chars max)
