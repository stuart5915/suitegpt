#!/usr/bin/env python3
"""
SUITE Content Publishing Daemon (Simple Version)

Uses basic HTTP requests - no special dependencies needed!

Usage:
    python scripts/publish-daemon.py
"""

import subprocess
import time
import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co'

# Try to get key from env, or fall back to .env.local file
def get_supabase_key():
    key = os.getenv('SUPABASE_ANON_KEY', '')
    if key:
        return key
    # Try reading from cadence-ai-nextjs .env.local
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
LOG_FILE = REPO_PATH / 'scripts' / 'publish-daemon.log'

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
# SUPABASE API (Simple HTTP)
# ═══════════════════════════════════════════════════════════════

def supabase_request(method: str, endpoint: str, data: dict = None) -> dict:
    """Make a request to Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

    body = json.dumps(data).encode('utf-8') if data else None

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        log(f"HTTP Error {e.code}: {error_body}")
        return []


def get_approved_content() -> list:
    """Fetch content with status = approved"""
    return supabase_request('GET', 'content_queue?status=eq.approved&order=created_at')


def update_status(content_id: str, status: str, extra: dict = None):
    """Update content status"""
    data = {'status': status}
    if extra:
        data.update(extra)

    # For PATCH we need different headers
    url = f"{SUPABASE_URL}/rest/v1/content_queue?id=eq.{content_id}"
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
        log(f"Update error: {e.code}")
        return False


# ═══════════════════════════════════════════════════════════════
# CONTENT PROCESSING
# ═══════════════════════════════════════════════════════════════

def build_claude_prompt(item: dict) -> str:
    """Build the prompt to send to Claude CLI"""
    tags = item.get('tags', [])
    tags_str = ', '.join(tags) if tags else 'general'

    prompt = f"""/publish-article

Title: {item['title']}
Tags: {tags_str}
Destination: {item.get('destination', 'learn')}

---

{item['content']}

---

Instructions:
1. Format this content as a proper article HTML file
2. Add to /learn/articles.html listing
3. Create the article HTML file in /learn/
4. Git commit and push
5. Report the published URL

Content ID: {item['id']}
"""
    return prompt.strip()


def process_content(item: dict) -> bool:
    """Process a single content item through Claude CLI"""
    content_id = item['id']
    title = item['title']

    log(f"Processing: {title}")
    update_status(content_id, 'processing')

    try:
        prompt = build_claude_prompt(item)

        log(f"Running Claude CLI in {REPO_PATH}")

        # Write prompt to temp file to avoid command line escaping issues
        prompt_file = REPO_PATH / 'scripts' / '.pending-prompt.txt'
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(prompt)

        # Run claude with the prompt file
        # Using powershell since claude is a .ps1 script on Windows
        cmd = f'Get-Content "{prompt_file}" | claude'
        result = subprocess.run(
            ['powershell', '-Command', cmd],
            capture_output=True,
            text=True,
            cwd=str(REPO_PATH),
            timeout=300
        )

        # Clean up temp file
        try:
            prompt_file.unlink()
        except:
            pass

        # Log what Claude CLI responded
        if result.stdout:
            log(f"Claude stdout: {result.stdout[:500]}")
        if result.stderr:
            log(f"Claude stderr: {result.stderr[:300]}")

        if result.returncode == 0:
            log(f"SUCCESS: {title}")
            update_status(content_id, 'published', {
                'published_at': datetime.now().isoformat()
            })
            return True
        else:
            log(f"FAILED: {title}")
            log(f"Error: {result.stderr[:200]}")
            update_status(content_id, 'failed', {
                'error_message': result.stderr[:500]
            })
            return False

    except subprocess.TimeoutExpired:
        log(f"TIMEOUT: {title}")
        update_status(content_id, 'failed', {'error_message': 'Timed out'})
        return False

    except Exception as e:
        log(f"ERROR: {title} - {str(e)}")
        update_status(content_id, 'failed', {'error_message': str(e)[:500]})
        return False


def check_and_process():
    """Check for approved content and process it"""
    try:
        items = get_approved_content()

        if items:
            log(f"Found {len(items)} approved item(s)")
            for item in items:
                process_content(item)
    except Exception as e:
        log(f"Error: {str(e)}")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_ANON_KEY not set!")
        print("Run: $env:SUPABASE_ANON_KEY=\"your-key-here\"")
        sys.exit(1)

    log("=" * 50)
    log("SUITE Publish Daemon Started")
    log(f"Repo: {REPO_PATH}")
    log(f"Poll interval: {POLL_INTERVAL}s")
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
