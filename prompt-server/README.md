# PC Prompt Server for Dual-Machine Coding

This folder contains the prompt server that runs on your PC.

## Setup (on PC):

```powershell
cd C:\Users\Stuart\stuart-hollinger-landing\prompt-server
pip install flask flask-cors
python server.py
```

## Usage (from Laptop):

1. Open browser: `http://10.0.0.142:3000`
2. Type your coding prompt
3. Hit Send
4. PC's Antigravity processes it
5. Changes push to GitHub
6. Laptop auto-pulls

## Files:
- `server.py` - Flask server that receives prompts
- `index.html` - Web UI for typing prompts
- `prompts/` - Folder where prompts are saved
