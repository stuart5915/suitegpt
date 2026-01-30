#!/usr/bin/env python3
"""
Claude Relay Server

Local HTTP server that receives prompts from the governance web UI
and opens a visible terminal window running Claude CLI.

Usage:
    python scripts/claude-relay-server.py

The web UI POSTs to http://localhost:5111/run with the prompt and metadata.
A new PowerShell window opens with Claude running — fully visible and interactive.
When Claude finishes, the request status is updated in Supabase automatically.
"""

import http.server
import json
import os
import subprocess
import sys
import threading
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

PORT = 5111
SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co'
REPO_PATH = Path(__file__).parent.parent.absolute()
CLAUDE_TIMEOUT = 600  # 10 minutes

def get_supabase_key():
    key = os.getenv('SUPABASE_ANON_KEY', '')
    if key:
        return key
    env_file = Path(__file__).parent.parent / 'cadence-ai-nextjs' / '.env.local'
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('NEXT_PUBLIC_SUPABASE_ANON_KEY='):
                    return line.split('=', 1)[1].strip()
    return ''

SUPABASE_KEY = get_supabase_key()


# ═══════════════════════════════════════════════════════════════
# SUPABASE HELPERS
# ═══════════════════════════════════════════════════════════════

def supabase_patch(record_id: str, data: dict):
    url = f"{SUPABASE_URL}/rest/v1/factory_proposals?id=eq.{record_id}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method='PATCH')
    try:
        with urllib.request.urlopen(req) as response:
            return True
    except urllib.error.HTTPError as e:
        print(f"  [!] PATCH error {e.code}: {e.read().decode('utf-8')}")
        return False


def supabase_get(endpoint: str) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    }
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"  [!] GET error {e.code}: {e.read().decode('utf-8')}")
        return []


def get_operator_context(client_app: str) -> str:
    if not client_app:
        return ''
    rows = supabase_get(
        f'suite_operators?select=project_context,name&or=(app_key.eq.{client_app},name.ilike.*{client_app}*)&limit=1'
    )
    if rows and len(rows) > 0 and rows[0].get('project_context'):
        print(f"  Found project context for {client_app} ({rows[0].get('name', 'unknown')})")
        return rows[0]['project_context']
    return ''


# ═══════════════════════════════════════════════════════════════
# CLAUDE RUNNER (runs in background thread)
# ═══════════════════════════════════════════════════════════════

def run_claude_in_terminal(record_id, title, client_app, project_dir, claude_prompt):
    """Spawn a visible terminal window running Claude, then update Supabase when done."""
    print(f"\n{'='*60}")
    print(f"  REQUEST: {title}")
    print(f"  App: {client_app} | Dir: {project_dir or 'repo root'}")
    print(f"  Record: {record_id}")
    print(f"{'='*60}")

    # Set status to processing
    supabase_patch(record_id, {'status': 'processing'})
    print(f"  Status → processing")

    # Build full prompt with project context
    project_context = get_operator_context(client_app)
    full_prompt = claude_prompt
    if project_context:
        full_prompt = f"""PROJECT CONTEXT:
{project_context}

WORKING DIRECTORY: {project_dir or 'repo root'}

---

CLIENT REQUEST:
{claude_prompt}"""
    elif project_dir:
        full_prompt = f"""WORKING DIRECTORY: {project_dir}

{claude_prompt}"""

    # Determine working directory
    if project_dir:
        cwd = REPO_PATH / project_dir
    else:
        cwd = REPO_PATH

    if not cwd.exists():
        error_msg = f"Project directory not found: {cwd}"
        print(f"  [!] FAILED: {error_msg}")
        supabase_patch(record_id, {
            'status': 'failed',
            'error_message': error_msg,
            'processed_at': datetime.now().isoformat()
        })
        return

    # Write prompt to temp file
    prompt_file = REPO_PATH / 'scripts' / '.pending-client-prompt.txt'
    with open(prompt_file, 'w', encoding='utf-8') as f:
        f.write(full_prompt)

    # Build a wrapper script that:
    # 1. Runs Claude with the prompt (visible in terminal)
    # 2. After Claude finishes, commits + pushes if there are changes
    # 3. Updates Supabase status via a small Python script
    wrapper_file = REPO_PATH / 'scripts' / '.claude-runner-wrapper.ps1'
    updater_file = REPO_PATH / 'scripts' / '.update-status.py'

    # Write the status updater script
    with open(updater_file, 'w', encoding='utf-8') as f:
        f.write(f'''import json, urllib.request, urllib.error, sys, subprocess
from pathlib import Path

SUPABASE_URL = "{SUPABASE_URL}"
SUPABASE_KEY = "{SUPABASE_KEY}"
REPO_PATH = r"{REPO_PATH}"
RECORD_ID = "{record_id}"
PROJECT_DIR = r"{project_dir}"

def patch(data):
    url = f"{{SUPABASE_URL}}/rest/v1/factory_proposals?id=eq.{{RECORD_ID}}"
    headers = {{
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {{SUPABASE_KEY}}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }}
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            pass
    except Exception as e:
        print(f"Status update error: {{e}}")

exit_code = int(sys.argv[1]) if len(sys.argv) > 1 else 1

if exit_code == 0:
    # Check for changes and commit
    result = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, cwd=REPO_PATH)
    changed = result.stdout.strip()
    if changed:
        print("\\n--- Committing changes ---")
        add_path = PROJECT_DIR if PROJECT_DIR else "."
        subprocess.run(["git", "add", add_path], cwd=REPO_PATH)
        msg = "[Client Request] {title.replace('"', "'")}"
        subprocess.run(["git", "commit", "-m", msg], cwd=REPO_PATH)
        push = subprocess.run(["git", "push"], capture_output=True, text=True, cwd=REPO_PATH, timeout=60)
        if push.returncode == 0:
            print("Pushed to remote!")
        else:
            print(f"Push failed: {{push.stderr[:300]}}")
    else:
        print("\\nNo file changes detected.")

    from datetime import datetime
    patch({{"status": "completed", "processed_at": datetime.now().isoformat()}})
    print("\\n=== Status: COMPLETED ===")
else:
    from datetime import datetime
    patch({{"status": "failed", "error_message": f"Claude exited with code {{exit_code}}", "processed_at": datetime.now().isoformat()}})
    print(f"\\n=== Status: FAILED (exit code {{exit_code}}) ===")

print("\\nPress Enter to close this window...")
input()
''')

    # Write the PowerShell wrapper
    with open(wrapper_file, 'w', encoding='utf-8') as f:
        f.write(f'''$Host.UI.RawUI.WindowTitle = "Claude - {title[:50]}"
Write-Host ""
Write-Host "{'='*60}" -ForegroundColor Cyan
Write-Host "  CLIENT REQUEST: {title.replace('"', "'")}" -ForegroundColor Cyan
Write-Host "  App: {client_app} | Dir: {project_dir or 'repo root'}" -ForegroundColor DarkCyan
Write-Host "{'='*60}" -ForegroundColor Cyan
Write-Host ""

Set-Location "{cwd}"

Write-Host "Running Claude CLI..." -ForegroundColor Yellow
Write-Host ""

Get-Content "{prompt_file}" | claude --dangerously-skip-permissions
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "{'='*60}" -ForegroundColor Cyan
Write-Host "  Claude finished (exit code: $exitCode)" -ForegroundColor Cyan
Write-Host "  Updating status..." -ForegroundColor DarkCyan
Write-Host "{'='*60}" -ForegroundColor Cyan

python "{updater_file}" $exitCode
''')

    # Open the wrapper in a new visible PowerShell window
    print(f"  Opening terminal window...")
    subprocess.Popen(
        ['powershell', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', str(wrapper_file)],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    print(f"  Terminal launched! Watch the new window.")


# ═══════════════════════════════════════════════════════════════
# HTTP SERVER
# ═══════════════════════════════════════════════════════════════

class RelayHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        """Health check endpoint."""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'port': PORT}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Receive a prompt and launch Claude in a visible terminal."""
        if self.path != '/run':
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_length).decode('utf-8'))

        record_id = body.get('id', '')
        title = body.get('title', 'Untitled')
        client_app = body.get('client_app', 'unknown')
        project_dir = body.get('client_project_dir', '')
        claude_prompt = body.get('claude_prompt', '')

        if not record_id or not claude_prompt:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing id or claude_prompt'}).encode())
            return

        # Launch in a background thread so we respond immediately
        thread = threading.Thread(
            target=run_claude_in_terminal,
            args=(record_id, title, client_app, project_dir, claude_prompt),
            daemon=True
        )
        thread.start()

        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'launched', 'record_id': record_id}).encode())

    def log_message(self, format, *args):
        # Quieter logging
        pass


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_ANON_KEY not set!")
        print('Run: $env:SUPABASE_ANON_KEY="your-key-here"')
        sys.exit(1)

    print("=" * 60)
    print("  Claude Relay Server")
    print(f"  Listening on http://localhost:{PORT}")
    print(f"  Repo: {REPO_PATH}")
    print("=" * 60)
    print()
    print("  Waiting for requests from governance dashboard...")
    print("  (Keep this window open)")
    print()

    server = http.server.HTTPServer(('127.0.0.1', PORT), RelayHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
