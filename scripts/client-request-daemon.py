#!/usr/bin/env python3
"""
Client Request Daemon

Polls factory_proposals for approved client requests and pipes them to Claude CLI.
Status flows back to Supabase so both factory.html and client admin dashboards update.

Usage:
    python scripts/client-request-daemon.py
"""

import subprocess
import time
import os
import sys
import json
import socket
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co'

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
REPO_PATH = Path(__file__).parent.parent.absolute()
POLL_INTERVAL = 30
LOG_FILE = REPO_PATH / 'scripts' / 'client-request-daemon.log'
CLAUDE_TIMEOUT = 600  # 10 minutes per request

# ═══════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════

def log(message: str):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(log_line + '\n')
    except:
        pass

# ═══════════════════════════════════════════════════════════════
# SUPABASE API
# ═══════════════════════════════════════════════════════════════

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
        error_body = e.read().decode('utf-8')
        log(f"HTTP Error {e.code}: {error_body}")
        return []


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
        log(f"PATCH error {e.code}: {e.read().decode('utf-8')}")
        return False


DAEMON_ID = 'client-request-daemon'


def send_heartbeat():
    """Upsert a heartbeat row so UIs know daemon is alive."""
    url = f"{SUPABASE_URL}/rest/v1/daemon_heartbeat"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
    }
    data = {
        'id': DAEMON_ID,
        'last_heartbeat': datetime.utcnow().isoformat() + 'Z',
        'hostname': socket.gethostname()
    }
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            pass
    except urllib.error.HTTPError as e:
        log(f"Heartbeat error: {e.code}")


def is_enabled() -> bool:
    """Check if daemon is enabled via daemon_heartbeat.enabled flag."""
    rows = supabase_get(f'daemon_heartbeat?id=eq.{DAEMON_ID}&select=enabled')
    if rows and len(rows) > 0:
        return rows[0].get('enabled', True) is not False
    return True  # default to enabled if no row exists yet


# ═══════════════════════════════════════════════════════════════
# PROCESSING
# ═══════════════════════════════════════════════════════════════

def get_approved_requests() -> list:
    return supabase_get(
        'factory_proposals?category=eq.client_request&status=eq.approved&order=created_at'
    )


def get_operator_context(client_app: str) -> str:
    """Look up project_context from suite_operators by matching name or app_key."""
    if not client_app:
        return ''
    # Try matching by app_key or name (case-insensitive)
    rows = supabase_get(
        f'suite_operators?select=project_context,name&or=(app_key.eq.{client_app},name.ilike.*{client_app}*)&limit=1'
    )
    if rows and len(rows) > 0 and rows[0].get('project_context'):
        log(f"Found project context for {client_app} ({rows[0].get('name', 'unknown')})")
        return rows[0]['project_context']
    return ''


def process_request(item: dict) -> bool:
    record_id = item['id']
    title = item.get('title', 'Untitled')
    client_app = item.get('client_app', 'unknown')
    project_dir = item.get('client_project_dir', '')
    claude_prompt = item.get('claude_prompt') or item.get('content', '')

    # Look up operator project context and prepend to prompt
    project_context = get_operator_context(client_app)
    if project_context:
        claude_prompt = f"""PROJECT CONTEXT:
{project_context}

WORKING DIRECTORY: {project_dir or 'repo root'}

---

CLIENT REQUEST:
{claude_prompt}"""
    elif project_dir:
        claude_prompt = f"""WORKING DIRECTORY: {project_dir}

{claude_prompt}"""

    log(f"Processing [{client_app}]: {title}")

    # Set status to processing
    supabase_patch(record_id, {'status': 'processing'})

    # Determine working directory
    if project_dir:
        cwd = REPO_PATH / project_dir
    else:
        cwd = REPO_PATH

    if not cwd.exists():
        error_msg = f"Project directory not found: {cwd}"
        log(f"FAILED: {error_msg}")
        supabase_patch(record_id, {
            'status': 'failed',
            'error_message': error_msg,
            'processed_at': datetime.now().isoformat()
        })
        return False

    try:
        # Write prompt to temp file
        prompt_file = REPO_PATH / 'scripts' / '.pending-client-prompt.txt'
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(claude_prompt)

        log(f"Opening visible terminal for Claude...")

        # Write a status-updater script that runs after Claude finishes
        updater_file = REPO_PATH / 'scripts' / f'.update-status-{record_id[:8]}.py'
        safe_title = title.replace("'", "\\'").replace('"', '\\"')
        with open(updater_file, 'w', encoding='utf-8') as f:
            f.write(f'''import json, urllib.request, urllib.error, sys, subprocess
from datetime import datetime
from pathlib import Path

SUPABASE_URL = "{SUPABASE_URL}"
SUPABASE_KEY = "{SUPABASE_KEY}"
REPO_PATH = r"{REPO_PATH}"
RECORD_ID = "{record_id}"
PROJECT_DIR = r"{project_dir}"
TITLE = """{safe_title}"""

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
        print()
        print("--- Committing changes ---")
        add_path = PROJECT_DIR if PROJECT_DIR else "."
        subprocess.run(["git", "add", add_path], cwd=REPO_PATH)
        msg = f"[Client Request] {{TITLE}}"
        subprocess.run(["git", "commit", "-m", msg], cwd=REPO_PATH)
        push = subprocess.run(["git", "push"], capture_output=True, text=True, cwd=REPO_PATH, timeout=60)
        if push.returncode == 0:
            print("Pushed to remote!")
        else:
            print(f"Push failed: {{push.stderr[:300]}}")
    else:
        print()
        print("No file changes detected.")

    patch({{"status": "completed", "processed_at": datetime.now().isoformat()}})
    print()
    print("=== COMPLETED ===")
else:
    patch({{"status": "failed", "error_message": f"Claude exited with code {{exit_code}}", "processed_at": datetime.now().isoformat()}})
    print()
    print(f"=== FAILED (exit code {{exit_code}}) ===")

print()
print("Press Enter to close this window...")
input()
''')

        # Write a PowerShell wrapper that runs Claude visibly
        wrapper_file = REPO_PATH / 'scripts' / f'.claude-runner-{record_id[:8]}.ps1'
        with open(wrapper_file, 'w', encoding='utf-8') as f:
            f.write(f'''$Host.UI.RawUI.WindowTitle = "Claude - {safe_title[:50]}"
Write-Host ""
Write-Host "{'='*60}" -ForegroundColor Cyan
Write-Host "  CLIENT REQUEST: {safe_title[:80]}" -ForegroundColor Cyan
Write-Host "  App: {client_app} | Dir: {project_dir or 'repo root'}" -ForegroundColor DarkCyan
Write-Host "{'='*60}" -ForegroundColor Cyan
Write-Host ""

Set-Location "{cwd}"

Write-Host "Running Claude CLI..." -ForegroundColor Yellow
Write-Host ""

Get-Content "{prompt_file}" | claude --print --dangerously-skip-permissions
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "{'='*60}" -ForegroundColor Cyan
Write-Host "  Claude finished (exit code: $exitCode)" -ForegroundColor Cyan
Write-Host "  Updating status + committing..." -ForegroundColor DarkCyan
Write-Host "{'='*60}" -ForegroundColor Cyan

python "{updater_file}" $exitCode
''')

        # Open Claude in a new visible PowerShell window
        subprocess.Popen(
            ['powershell', '-ExecutionPolicy', 'Bypass', '-File', str(wrapper_file)],
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )

        log(f"Terminal opened for: {title}")
        return True

    except Exception as e:
        error_msg = str(e)[:1000]
        log(f"ERROR launching terminal: {title} — {error_msg}")
        supabase_patch(record_id, {
            'status': 'failed',
            'error_message': error_msg,
            'processed_at': datetime.now().isoformat()
        })
        return False


def check_and_process():
    try:
        send_heartbeat()

        if not is_enabled():
            log("Daemon paused (disabled via toggle)")
            return

        items = get_approved_requests()
        if items:
            log(f"Found {len(items)} approved client request(s)")
            for item in items:
                process_request(item)
    except Exception as e:
        log(f"Poll error: {str(e)}")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_ANON_KEY not set!")
        print('Run: $env:SUPABASE_ANON_KEY="your-key-here"')
        sys.exit(1)

    log("=" * 50)
    log("Client Request Daemon Started")
    log(f"Repo: {REPO_PATH}")
    log(f"Poll interval: {POLL_INTERVAL}s")
    log(f"Claude timeout: {CLAUDE_TIMEOUT}s")
    log("=" * 50)

    while True:
        try:
            check_and_process()
        except KeyboardInterrupt:
            log("Shutting down...")
            break
        except Exception as e:
            log(f"Unexpected error: {str(e)}")

        time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    main()
