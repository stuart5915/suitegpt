# IDE Auto-Prompt Runner

Automatically watches the prompts folder and types commands into the Antigravity IDE when new prompts arrive.

## 🚀 Quick Start

1. **Open Antigravity IDE** (keep it open and visible)
2. **Double-click** `run-auto-prompt.bat`
3. **Leave it running** - it will auto-process prompts!

## 🛡️ Safety Features

| Feature | Description |
|---------|-------------|
| **Failsafe Abort** | Move mouse to TOP-LEFT corner to instantly stop |
| **Crash Detection** | Stops after 3 consecutive failures |
| **Cooldown Timer** | 60s wait between commands (lets IDE process) |
| **Window Check** | Only types if IDE window is found |

## ⚙️ Configuration

Edit `auto-prompt-runner.py` to change:

```python
PROMPTS_FOLDER = r"C:\Users\info\..."  # Where prompts appear
IDE_WINDOW_TITLE = "Antigravity"       # Window title to find
COMMAND_TO_TYPE = "Process all..."     # Command to type
CHECK_INTERVAL = 5                      # Seconds between checks
COOLDOWN_AFTER_COMMAND = 60            # Seconds between commands
```

## 📋 Requirements

- Python 3.x
- Windows
- Antigravity IDE open
- Packages: `pyautogui`, `pygetwindow` (auto-installed by bat file)

## 🔴 Stopping

- **Immediate:** Move mouse to top-left corner
- **Graceful:** Press `Ctrl+C` in the terminal
- **Close terminal:** Just close the window
