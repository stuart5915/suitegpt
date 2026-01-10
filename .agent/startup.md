# Quick Startup Guide

## 💻 LAPTOP (3 terminals)

```powershell
# Terminal 1: Portal server (for pull/push buttons)
cd c:\Users\info\Documents\stuart-hollinger-landing\stuart-hollinger-landing\prompt-server
python server.py

# Terminal 2: Website preview
cd c:\Users\info\Documents\stuart-hollinger-landing\stuart-hollinger-landing
python -m http.server 8000

# Terminal 3: Keep open for git commands
```

**Open:** http://10.0.0.142:3000 (send prompts to PC)

---

## 🖥️ PC (3 things)

```powershell
# Set Supabase key (once per session)
$env:SUPABASE_SERVICE_KEY = "your-key-here"

# Terminal 1: Server
cd C:\Users\Stuart\stuart-hollinger-landing\prompt-server
python server.py

# Terminal 2: Watcher
cd C:\Users\Stuart\stuart-hollinger-landing\prompt-server
python watcher.py
```

**Open:** 2-4 Antigravity windows, tile on monitor 2

---

## ✅ Ready when you see:
- Laptop: "Serving HTTP on port 8000"
- PC: "READY! Send prompts via Discord /addition command"
