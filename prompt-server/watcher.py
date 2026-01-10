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
WAIT_TIME_AFTER_PROMPT = 45  # 45 seconds to wait for AI

# ═══ PROMPT PREFIX ═══
# Added to every prompt to prevent AI from asking questions
PROMPT_PREFIX = "[NO QUESTIONS - just make your best attempt] "

# ═══ WINDOW SLOTS - EXACT COORDINATES ═══
# Measured using get_coords.py on Stuart's PC
# Each slot has: chat input coords, accept button coords, and window region for screenshots

WINDOW_SLOTS = [
    # Slot 0: Top-left window
    {"chat_x": 3228, "chat_y": 585, "accept_x": 3438, "accept_y": 553, "region": (2560, 0, 960, 540)},
    # Slot 1: Top-right window  
    {"chat_x": 4227, "chat_y": 594, "accept_x": 4415, "accept_y": 560, "region": (3520, 0, 960, 540)},
    # Slot 2: Bottom-left window
    {"chat_x": 3207, "chat_y": 1154, "accept_x": 3441, "accept_y": 1119, "region": (2560, 540, 960, 540)},
    # Slot 3: Bottom-right window
    {"chat_x": 4226, "chat_y": 1151, "accept_x": 4415, "accept_y": 1119, "region": (3520, 540, 960, 540)},
]

# Screenshots directory
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# ═══ PARALLEL PROCESSING STATE ═══
# Thread-safe slot management for multi-window processing
SLOT_STATE_FILE = os.path.join(os.path.dirname(__file__), '.slot_state.json')

def load_slot_state():
    """Load slot state from file (persists across restarts)"""
    try:
        if os.path.exists(SLOT_STATE_FILE):
            with open(SLOT_STATE_FILE, 'r') as f:
                import json
                state = json.load(f)
                return state.get('busy', [False]*4), state.get('index', 0)
    except:
        pass
    return [False, False, False, False], 0

def save_slot_state():
    """Save slot state to file"""
    try:
        import json
        with open(SLOT_STATE_FILE, 'w') as f:
            json.dump({'busy': slot_busy, 'index': current_slot_index}, f)
    except:
        pass

# Load previous state on startup
_loaded_busy, _loaded_index = load_slot_state()
slot_busy = _loaded_busy  # Track which slots are processing
slot_typing = [False, False, False, False]  # Track which slots are actively typing (DO NOT CLICK)
slot_locks = [threading.Lock() for _ in range(4)]  # Per-slot locks
git_lock = threading.Lock()  # Serialize git operations
slot_allocation_lock = threading.Lock()  # Lock for picking next slot
current_slot_index = _loaded_index  # Round-robin counter (persisted)


def get_next_slot():
    """Get the next slot round-robin style (thread-safe). Always returns a slot - Antigravity queues messages."""
    global current_slot_index
    with slot_allocation_lock:
        slot = current_slot_index
        current_slot_index = (current_slot_index + 1) % len(WINDOW_SLOTS)
        slot_busy[slot] = True  # Mark as busy for status display
        save_slot_state()  # Persist state
        return slot


def release_slot(slot_index):
    """Mark a slot as available again (for status display)."""
    with slot_allocation_lock:
        if 0 <= slot_index < len(slot_busy):
            slot_busy[slot_index] = False
            save_slot_state()  # Persist state


def get_signal_file(slot_index):
    """Get the signal file path for a specific slot."""
    return os.path.join(REPO_DIR, f'.agent-done-{slot_index}')


def get_slot_status():
    """Get a status string showing which slots are busy."""
    status = []
    for i, busy in enumerate(slot_busy):
        status.append(f"W{i}:{'🔴' if busy else '🟢'}")
    return ' '.join(status)


def get_latest_file_mtime():
    """Get the most recent modification time of any file in the repo (for idle detection)."""
    latest_mtime = 0
    try:
        for root, dirs, files in os.walk(REPO_DIR):
            # Skip hidden folders and node_modules
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
            for f in files:
                if f.startswith('.'):
                    continue
                try:
                    fpath = os.path.join(root, f)
                    mtime = os.path.getmtime(fpath)
                    if mtime > latest_mtime:
                        latest_mtime = mtime
                except:
                    pass
    except:
        pass
    return latest_mtime


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
    
    def update_status(self, prompt_id, status, result=None, slot_index=None):
        """Update prompt status"""
        try:
            data = {'status': status}
            if status == 'completed' or status == 'failed':
                data['processed_at'] = 'now()'
            if result:
                data['result'] = result
            if slot_index is not None:
                data['slot_index'] = slot_index
            
            response = requests.patch(
                f'{self.url}/rest/v1/prompts?id=eq.{prompt_id}',
                headers=self.headers,
                json=data
            )
            return response.ok
        except Exception as e:
            print(f'[ERROR] Failed to update status: {e}')
            return False
    
    def get_pending_responses(self):
        """Get prompts that have a response ready to send"""
        try:
            response = requests.get(
                f'{self.url}/rest/v1/prompts?status=eq.responding&order=updated_at.asc',
                headers=self.headers
            )
            if response.ok:
                return response.json()
            return []
        except:
            return []


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
    """Process a single prompt from Supabase (thread-safe for parallel execution)"""
    prompt_id = prompt_data['id']
    prompt_text = prompt_data['prompt']
    target = prompt_data.get('target', 'stuart-hollinger-landing')
    
    # Get next slot round-robin (Antigravity queues messages, so we keep going)
    slot_index = get_next_slot()
    slot = WINDOW_SLOTS[slot_index]
    
    print(f'\n{"="*60}')
    print(f'[NEW PROMPT] {prompt_id[:8]}... → Window {slot_index}')
    print(f'[TARGET] {target}')
    print(f'[STATUS] {get_slot_status()}')
    print(f'{"="*60}')
    print(f'{prompt_text[:200]}...' if len(prompt_text) > 200 else prompt_text)
    print(f'{"="*60}\n')
    
    # Mark as processing
    supabase.update_status(prompt_id, 'processing')
    
    try:
        # Git pull first (with lock to serialize)
        with git_lock:
            git_pull()
        
        # MARK SLOT AS TYPING - prevents other threads from clicking accept on this slot
        slot_typing[slot_index] = True
        
        # Step 1: Left-click to focus the chat input
        print(f'[W{slot_index}] Clicking chat at ({slot["chat_x"]}, {slot["chat_y"]})...')
        pyautogui.click(slot["chat_x"], slot["chat_y"])
        time.sleep(0.5)
        
        # Step 2: Type the prompt (with prefix)
        print(f'[W{slot_index}] Typing prompt...')
        full_prompt = PROMPT_PREFIX + prompt_text
        safe_text = ''.join(c if c.isascii() and c.isprintable() else ' ' for c in full_prompt)
        pyautogui.typewrite(safe_text, interval=0.02)
        time.sleep(0.3)
        
        # Step 3: Send with Enter
        print(f'[W{slot_index}] Pressing Enter to send...')
        pyautogui.press('enter')
        print(f'[W{slot_index}] Sent prompt to Antigravity')
        
        # MARK TYPING COMPLETE - safe to click accept on this slot now
        slot_typing[slot_index] = False
        
        # Wait for agent to finish using IDLE DETECTION
        # If no files have been modified for 30 seconds, agent is done
        max_wait = 300  # 5 minute max (safety timeout)
        idle_threshold = 30  # 30 seconds of no changes = done
        check_interval = 2  # Check every 2 seconds
        accept_interval = 5  # Click Accept every 5 seconds
        
        print(f'[W{slot_index}] Waiting for agent... (idle detection: {idle_threshold}s of no changes)')
        
        start_time = time.time()
        last_accept_time = 0
        last_change_time = time.time()  # Track when files last changed
        initial_mtime = get_latest_file_mtime()  # Baseline to detect ANY changes
        last_mtime = initial_mtime
        agent_done = False
        had_activity = False  # Track if ANY file changes occurred
        
        while time.time() - start_time < max_wait:
            # Check if files have been modified
            current_mtime = get_latest_file_mtime()
            if current_mtime > last_mtime:
                # Files changed - reset idle timer and mark activity
                last_mtime = current_mtime
                last_change_time = time.time()
                had_activity = True
            
            # Check if we've been idle long enough
            idle_time = time.time() - last_change_time
            if idle_time >= idle_threshold:
                if had_activity:
                    print(f'[W{slot_index}] Agent idle for {int(idle_time)}s - changes detected, done!')
                    agent_done = True
                    break
                else:
                    # No file changes at all - AI might be asking questions
                    print(f'[W{slot_index}] Idle but NO file changes - AI may be waiting for input')
            
            # Click Accept button periodically + press Alt+Enter for command approvals
            elapsed = time.time() - start_time
            if elapsed - last_accept_time >= accept_interval:
                try:
                    # Click the main Accept button
                    pyautogui.click(slot["accept_x"], slot["accept_y"])
                    # Also press Alt+Enter to approve any command dialogs
                    pyautogui.hotkey('alt', 'Return')
                    print(f'[W{slot_index}] Auto-Accept + Alt+Enter - {int(elapsed)}s elapsed, idle: {int(idle_time)}s')
                    last_accept_time = elapsed
                except:
                    pass
            
            time.sleep(check_interval)
        
        if agent_done:
            print(f'[W{slot_index}] Agent signaled completion!')
        else:
            print(f'[W{slot_index}] Timeout ({max_wait}s) reached, proceeding anyway...')
        
        # Click in the window to ensure focus
        pyautogui.click(slot["chat_x"], slot["chat_y"])
        time.sleep(0.3)
        
        # Save with Ctrl+S
        print(f'[W{slot_index}] Pressing Ctrl+S to save...')
        pyautogui.hotkey('ctrl', 's')
        time.sleep(2)
        
        # ACCEPT ALL WINDOWS - sweep through all windows EXCEPT ones currently typing
        print(f'[W{slot_index}] Accept-all sweep before push (skipping typing slots)...')
        for i, s in enumerate(WINDOW_SLOTS):
            if slot_typing[i]:
                print(f'[W{slot_index}] Skipping slot {i} - currently typing')
                continue
            try:
                # Click Accept button
                pyautogui.click(s["accept_x"], s["accept_y"])
                time.sleep(0.1)
                # Press Alt+Enter for command dialogs
                pyautogui.hotkey('alt', 'Return')
                time.sleep(0.1)
            except:
                pass
        time.sleep(1)
        
        # Git operations (serialized with lock)
        with git_lock:
            git_pull()
            git_push()
        
        # Mark completed (or needs-review if no changes were made)
        if had_activity:
            supabase.update_status(prompt_id, 'completed', 'Successfully processed')
            print(f'[W{slot_index}] ✅ Prompt {prompt_id[:8]} completed!')
        else:
            # Take a screenshot of the window to show what AI responded
            screenshot_filename = f'{prompt_id}.png'
            screenshot_path = os.path.join(SCREENSHOTS_DIR, screenshot_filename)
            try:
                region = slot.get('region')
                if region:
                    screenshot = pyautogui.screenshot(region=region)
                    screenshot.save(screenshot_path)
                    print(f'[W{slot_index}] 📸 Screenshot saved: {screenshot_filename}')
            except Exception as e:
                print(f'[W{slot_index}] Could not capture screenshot: {e}')
            
            supabase.update_status(prompt_id, 'needs-review', 'No file changes detected - AI may have asked questions', slot_index=slot_index)
            print(f'[W{slot_index}] ⚠️ Prompt {prompt_id[:8]} needs review - no code changes detected')
        
    except Exception as e:
        print(f'[W{slot_index}] ❌ Failed: {e}')
        supabase.update_status(prompt_id, 'failed', str(e))
    
    finally:
        # ALWAYS release the slot when done
        release_slot(slot_index)
        print(f'[W{slot_index}] Slot released. {get_slot_status()}')


def git_pull():
    """Pull latest changes"""
    print('[GIT] Pulling latest...')
    try:
        os.chdir(REPO_DIR)
        subprocess.run(['git', 'pull', '--rebase'], capture_output=True)
    except Exception as e:
        print(f'[GIT] Pull error: {e}')


def git_push():
    """Push changes to GitHub with retry logic"""
    print('[GIT] Pushing changes...')
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            os.chdir(REPO_DIR)
            subprocess.run(['git', 'add', '-A'], check=True)
            result = subprocess.run(
                ['git', 'commit', '-m', 'Auto-commit from PC watcher'],
                capture_output=True, text=True
            )
            
            if 'nothing to commit' in result.stdout:
                print('[GIT] Nothing to commit')
                return
            
            # Try to push
            push_result = subprocess.run(
                ['git', 'push', 'origin', 'master'],
                capture_output=True, text=True
            )
            
            if push_result.returncode == 0:
                print('[GIT] Push successful!')
                return
            else:
                # Push failed - likely remote is ahead, pull and retry
                print(f'[GIT] Push failed (attempt {attempt + 1}), pulling and retrying...')
                subprocess.run(['git', 'pull', '--rebase'], capture_output=True)
                
        except Exception as e:
            print(f'[GIT] Push error (attempt {attempt + 1}): {e}')
            if attempt < max_retries - 1:
                subprocess.run(['git', 'pull', '--rebase'], capture_output=True)
    
    print('[GIT] Push failed after all retries')


def send_response(response_data):
    """Send a user's response to a specific Antigravity window slot"""
    prompt_id = response_data['id']
    response_text = response_data.get('response', '')
    slot_index = response_data.get('slot_index', 0)
    
    if not response_text:
        print(f'[RESPONSE] No response text for {prompt_id[:8]}')
        return
    
    if slot_index is None or slot_index < 0 or slot_index >= len(WINDOW_SLOTS):
        slot_index = 0  # Default to first slot
    
    slot = WINDOW_SLOTS[slot_index]
    
    print(f'\n{"="*60}')
    print(f'[RESPONSE] Sending to Window {slot_index}')
    print(f'{"="*60}')
    print(f'{response_text[:100]}...' if len(response_text) > 100 else response_text)
    print(f'{"="*60}\n')
    
    try:
        # Mark as processing
        supabase.update_status(prompt_id, 'response-sending')
        
        # Mark slot as typing
        slot_typing[slot_index] = True
        
        # Click chat input
        pyautogui.click(slot["chat_x"], slot["chat_y"])
        time.sleep(0.5)
        
        # Type the response
        safe_text = ''.join(c if c.isascii() and c.isprintable() else ' ' for c in response_text)
        pyautogui.typewrite(safe_text, interval=0.02)
        time.sleep(0.3)
        
        # Send with Enter
        pyautogui.press('enter')
        
        # Done typing
        slot_typing[slot_index] = False
        
        # Mark as back to processing (now waiting for AI again)
        supabase.update_status(prompt_id, 'processing', 'Response sent, waiting for AI')
        print(f'[RESPONSE] ✅ Response sent to Window {slot_index}!')
        
    except Exception as e:
        slot_typing[slot_index] = False
        print(f'[RESPONSE] ❌ Failed: {e}')
        supabase.update_status(prompt_id, 'needs-review', f'Response failed: {e}')


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
            
            # Poll for pending responses (user replied to AI question)
            responses = supabase.get_pending_responses()
            if responses:
                for resp in responses:
                    threading.Thread(target=send_response, args=(resp,)).start()
                    time.sleep(0.5)
            
            if not prompts and not responses:
                status = window_manager.status()
                print(f'\r[POLL] No pending prompts | {status}', end='', flush=True)
            
            time.sleep(POLL_INTERVAL)
            
    except KeyboardInterrupt:
        print('\n\n[STOPPED] Watcher stopped.')


if __name__ == '__main__':
    main()
