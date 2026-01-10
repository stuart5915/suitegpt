# Supabase Prompt Watcher - Polls Supabase for prompts and injects into Antigravity
# 
# SETUP:
#   pip install pyautogui pyperclip pygetwindow requests
#
# USAGE:
#   1. Open 2-3 Antigravity IDE windows on your PC (duplicate workspace)
#   2. Set your Supabase credentials below or in environment variables
#   3. Run: python watcher.py
#   4. Send prompts via Discord /addition command from anywhere!

import os
import sys
import time
import threading
import subprocess
import requests

try:
    import pyautogui
    import pyperclip
    import pygetwindow as gw
except ImportError:
    print("Installing required packages...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyautogui', 'pyperclip', 'pygetwindow', 'requests'])
    import pyautogui
    import pyperclip
    import pygetwindow as gw

# ═══ CONFIGURATION ═══
# Set these or use environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rdsmdywbdiskxknluiym.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')  # Set this!

REPO_DIR = r'C:\Users\Stuart\stuart-hollinger-landing'
POLL_INTERVAL = 5  # seconds
WAIT_TIME_AFTER_PROMPT = 45  # seconds to wait for AI

# PyAutoGUI settings
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1


class SupabaseClient:
    """Simple Supabase REST client"""
    
    def __init__(self, url, key):
        self.url = url
        self.key = key
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json'
        }
    
    def get_pending_prompts(self):
        """Get all pending prompts ordered by creation time"""
        try:
            response = requests.get(
                f'{self.url}/rest/v1/prompts?status=eq.pending&order=created_at.asc',
                headers=self.headers
            )
            if response.ok:
                return response.json()
            else:
                print(f'[ERROR] Failed to fetch prompts: {response.text}')
                return []
        except Exception as e:
            print(f'[ERROR] Supabase connection failed: {e}')
            return []
    
    def update_status(self, prompt_id, status, result=None):
        """Update prompt status"""
        try:
            data = {'status': status}
            if status == 'completed' or status == 'failed':
                data['processed_at'] = 'now()'
            if result:
                data['result'] = result
            
            response = requests.patch(
                f'{self.url}/rest/v1/prompts?id=eq.{prompt_id}',
                headers=self.headers,
                json=data
            )
            return response.ok
        except Exception as e:
            print(f'[ERROR] Failed to update status: {e}')
            return False


class WindowManager:
    """Manages multiple Antigravity windows"""
    
    def __init__(self):
        self.windows = []
        self.current_index = 0
        self.busy_windows = set()
        self.lock = threading.Lock()
    
    def refresh_windows(self):
        """Find all Antigravity windows"""
        self.windows = []
        patterns = ['Antigravity', 'idx', 'Google Antigravity', 'stuart-hollinger']
        
        for pattern in patterns:
            try:
                found = gw.getWindowsWithTitle(pattern)
                for w in found:
                    if w not in self.windows and w.visible:
                        self.windows.append(w)
            except:
                pass
        
        # Don't deduplicate - keep all windows even with same title
        return len(self.windows)
    
    def get_next_window(self):
        """Get next available window round-robin style"""
        with self.lock:
            self.refresh_windows()
            if not self.windows:
                return None
            
            for _ in range(len(self.windows)):
                window = self.windows[self.current_index]
                self.current_index = (self.current_index + 1) % len(self.windows)
                if id(window) not in self.busy_windows:
                    return window
            
            # All busy, return next anyway
            window = self.windows[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.windows)
            return window
    
    def mark_busy(self, window):
        with self.lock:
            self.busy_windows.add(id(window))
    
    def mark_available(self, window):
        with self.lock:
            self.busy_windows.discard(id(window))
    
    def status(self):
        self.refresh_windows()
        return f'{len(self.windows)} windows, {len(self.busy_windows)} busy'


# Global instances
supabase = None
window_manager = WindowManager()


def process_prompt(prompt_data):
    """Process a single prompt from Supabase"""
    prompt_id = prompt_data['id']
    prompt_text = prompt_data['prompt']
    target = prompt_data.get('target', 'stuart-hollinger-landing')
    
    print(f'\n{"="*60}')
    print(f'[NEW PROMPT] {prompt_id[:8]}...')
    print(f'[TARGET] {target}')
    print(f'{"="*60}')
    print(f'{prompt_text[:200]}...' if len(prompt_text) > 200 else prompt_text)
    print(f'{"="*60}\n')
    
    # Mark as processing
    supabase.update_status(prompt_id, 'processing')
    
    # Get a window
    window = window_manager.get_next_window()
    if not window:
        print('[ERROR] No Antigravity windows found!')
        supabase.update_status(prompt_id, 'failed', 'No Antigravity windows available')
        return
    
    window_manager.mark_busy(window)
    
    try:
        # Activate window (but don't maximize - preserve tiled layout)
        try:
            window.activate()
            time.sleep(0.5)
            print(f'[WINDOW] Activated: {window.title[:40]}...')
        except Exception as e:
            print(f'[WARNING] Could not activate window: {e}')
        
        # Git pull first
        git_pull()
        
        # Wait for window to be ready
        time.sleep(1)
        
        # Type the prompt directly (like auto-prompt-runner.py)
        # typewrite is more reliable than paste
        print('[ACTION] Typing prompt into Antigravity...')
        pyautogui.typewrite(prompt_text, interval=0.03)
        time.sleep(0.5)
        
        # Send with Enter
        print('[ACTION] Pressing Enter to send...')
        pyautogui.press('enter')
        print('[ACTION] Sent prompt to Antigravity')
        
        # Wait for AI
        print(f'[WAITING] {WAIT_TIME_AFTER_PROMPT}s for AI response...')
        time.sleep(WAIT_TIME_AFTER_PROMPT)
        
        # Git push
        git_push()
        
        # Mark completed
        supabase.update_status(prompt_id, 'completed', 'Successfully processed')
        print(f'[DONE] Prompt {prompt_id[:8]} completed!')
        
    except Exception as e:
        print(f'[ERROR] Failed to process prompt: {e}')
        supabase.update_status(prompt_id, 'failed', str(e))
    finally:
        window_manager.mark_available(window)


def git_pull():
    """Pull latest changes"""
    print('[GIT] Pulling latest...')
    try:
        os.chdir(REPO_DIR)
        subprocess.run(['git', 'pull', '--rebase'], capture_output=True)
    except Exception as e:
        print(f'[GIT] Pull error: {e}')


def git_push():
    """Push changes to GitHub"""
    print('[GIT] Pushing changes...')
    try:
        os.chdir(REPO_DIR)
        subprocess.run(['git', 'add', '-A'], check=True)
        result = subprocess.run(
            ['git', 'commit', '-m', 'Auto-commit from PC watcher'],
            capture_output=True, text=True
        )
        if 'nothing to commit' not in result.stdout:
            subprocess.run(['git', 'push', 'origin', 'master'], check=True)
            print('[GIT] Push successful!')
        else:
            print('[GIT] Nothing to commit')
    except Exception as e:
        print(f'[GIT] Push error: {e}')


def main():
    global supabase
    
    # Check for Supabase key
    if not SUPABASE_KEY:
        print('=' * 60)
        print('ERROR: SUPABASE_SERVICE_KEY not set!')
        print('=' * 60)
        print('Set it as an environment variable:')
        print('  $env:SUPABASE_SERVICE_KEY = "your-key-here"')
        print('')
        print('Or edit this file and set SUPABASE_KEY directly.')
        print('=' * 60)
        sys.exit(1)
    
    supabase = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
    
    # Initial window detection
    count = window_manager.refresh_windows()
    
    print('=' * 60)
    print('SUPABASE PROMPT WATCHER')
    print('=' * 60)
    print(f'Polling: {SUPABASE_URL}')
    print(f'Interval: Every {POLL_INTERVAL} seconds')
    print(f'Windows: {count} Antigravity window(s) detected')
    print('')
    print('READY! Send prompts via Discord /addition command.')
    print('Press Ctrl+C to stop.')
    print('=' * 60)
    
    if count == 0:
        print('\n⚠️  WARNING: No Antigravity windows detected!')
        print('    Open Antigravity IDE to start processing.\n')
    
    try:
        while True:
            # Poll for pending prompts
            prompts = supabase.get_pending_prompts()
            
            if prompts:
                print(f'\n[POLL] Found {len(prompts)} pending prompt(s)')
                for prompt_data in prompts:
                    threading.Thread(target=process_prompt, args=(prompt_data,)).start()
                    time.sleep(1)  # Stagger launches
            else:
                status = window_manager.status()
                print(f'\r[POLL] No pending prompts | {status}', end='', flush=True)
            
            time.sleep(POLL_INTERVAL)
            
    except KeyboardInterrupt:
        print('\n\n[STOPPED] Watcher stopped.')


if __name__ == '__main__':
    main()
