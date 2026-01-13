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
import json
import threading
import subprocess
import requests

# TELOS Mode - Autonomous app generation
try:
    import telos_generator as telos
    import telos_builder as builder
    TELOS_AVAILABLE = True
except ImportError as e:
    TELOS_AVAILABLE = False
    print(f"[WARN] TELOS modules not available: {e}")

try:
    import pyautogui
    import pyperclip
    import pygetwindow as gw
    import keyboard  # For spacebar pause toggle
except ImportError:
    print("Installing required packages...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyautogui', 'pyperclip', 'pygetwindow', 'requests', 'keyboard'])
    import pyautogui
    import pyperclip
    import pygetwindow as gw
    import keyboard

# ═══ CONFIGURATION ═══
# Set these or use environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rdsmdywbdiskxknluiym.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')  # Set this!

REPO_DIR = r'C:\Users\Stuart\stuart-hollinger-landing'
POLL_INTERVAL = 5  # seconds
WAIT_TIME_AFTER_PROMPT = 45  # 45 seconds to wait for AI

# ═══ PAUSE STATE ═══
# Press SPACE to toggle pause, or create .pause file
PAUSE_FILE = os.path.join(os.path.dirname(__file__), '.pause')
paused = False  # Runtime pause state

def toggle_pause():
    global paused
    paused = not paused
    status = "PAUSED ⏸️" if paused else "RUNNING ▶️"
    print(f'\n[SPACEBAR] {status} - Press SPACE again to toggle\n')

# Register spacebar hotkey
keyboard.on_press_key('space', lambda e: toggle_pause())

# ═══ PROMPT PREFIX ═══
# Added to every prompt to prevent AI from asking questions and opening browsers
PROMPT_PREFIX = "[NO QUESTIONS - just make your best attempt. DO NOT open browser or run dev servers.] "

# ═══ WINDOW SLOTS - EXACT COORDINATES ═══
# Measured using get_coords.py on Stuart's PC
# Each slot has: chat input coords, accept button coords, and window region for screenshots

WINDOW_SLOTS = [
    # Slot 0: Top-left window
    {"chat_x": 3228, "chat_y": 585, "accept_x": 3438, "accept_y": 553, "retry_x": 3480, "retry_y": 510, "region": (2560, 0, 960, 540)},
    # Slot 1: Top-right window  
    {"chat_x": 4227, "chat_y": 594, "accept_x": 4415, "accept_y": 560, "retry_x": 4457, "retry_y": 517, "region": (3520, 0, 960, 540)},
    # Slot 2: Bottom-left window
    {"chat_x": 3207, "chat_y": 1154, "accept_x": 3441, "accept_y": 1119, "retry_x": 3483, "retry_y": 1076, "region": (2560, 540, 960, 540)},
    # Slot 3: Bottom-right window
    {"chat_x": 4226, "chat_y": 1151, "accept_x": 4415, "accept_y": 1119, "retry_x": 4457, "retry_y": 1076, "region": (3520, 540, 960, 540)},
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
prompt_incoming = False  # Signal background thread to stop sweep when prompt arrives


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
    target_slot = prompt_data.get('target_slot')  # 1-4 for specific box, None for auto-cycle
    
    # SIGNAL BACKGROUND THREAD TO STOP - prevents sweep from clicking while we prepare
    global prompt_incoming
    prompt_incoming = True
    time.sleep(0.3)  # Give background thread time to finish current action
    
    # Get slot - either targeted (0-indexed) or round-robin
    if target_slot is not None and 1 <= target_slot <= len(WINDOW_SLOTS):
        slot_index = target_slot - 1  # Convert to 0-indexed
        slot_busy[slot_index] = True  # Mark as busy
        print(f'\n{"="*60}')
        print(f'[NEW PROMPT] {prompt_id[:8]}... → Window {slot_index} (TARGETED Box {target_slot})')
    else:
        slot_index = get_next_slot()
        print(f'\n{"="*60}')
        print(f'[NEW PROMPT] {prompt_id[:8]}... → Window {slot_index} (auto-cycle)')
    
    # Check for Smart Prompt metadata
    metadata = prompt_data.get('metadata', {})
    if isinstance(metadata, str):
        try:
            import json
            metadata = json.loads(metadata)
        except:
            metadata = {}
    
    recommended_model = metadata.get('recommended_model', 'sonnet')
    complexity = metadata.get('complexity', 'low')
    
    slot = WINDOW_SLOTS[slot_index]
    print(f'[TARGET] {target}')
    print(f'[MODEL] {recommended_model.upper()} ({complexity} complexity)')
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
        
        # NOTE: prompt_incoming stays True until after typing completes
        # This provides double protection with slot_typing
        
        # Step 1: Left-click to focus the chat input
        print(f'[W{slot_index}] Clicking chat at ({slot["chat_x"]}, {slot["chat_y"]})...')
        pyautogui.click(slot["chat_x"], slot["chat_y"])
        time.sleep(0.5)
        
        # Step 2: Type the prompt (with prefix)
        print(f'[W{slot_index}] Typing prompt...')
        full_prompt = PROMPT_PREFIX + prompt_text
        safe_text = ''.join(c if c.isascii() and c.isprintable() else ' ' for c in full_prompt)
        pyautogui.typewrite(safe_text, interval=0.01)  # 0.01 = 100 chars/sec (fast but reliable)
        time.sleep(0.3)
        
        # Step 3: Send with Enter
        print(f'[W{slot_index}] Pressing Enter to send...')
        pyautogui.press('enter')
        print(f'[W{slot_index}] ✅ Prompt dispatched to Antigravity')
        
        # NOW it's safe to clear prompt_incoming - typing is done
        prompt_incoming = False
        
        # MARK TYPING COMPLETE - safe to click accept on this slot now
        slot_typing[slot_index] = False
        
        # INSTANT DISPATCH - Don't wait! Just mark as sent and return
        # Background push thread will handle git sync
        supabase.update_status(prompt_id, 'sent', 'Dispatched to Antigravity')
        print(f'[W{slot_index}] Prompt {prompt_id[:8]} dispatched - background push will sync')
        
    except Exception as e:
        print(f'[W{slot_index}] ❌ Failed: {e}')
        supabase.update_status(prompt_id, 'failed', str(e))
    
    finally:
        # ALWAYS release the slot when done
        slot_typing[slot_index] = False  # Ensure typing flag is cleared
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
                # Write timestamp to file for server.py to read
                push_time_file = os.path.join(os.path.dirname(__file__), '.last_push')
                with open(push_time_file, 'w') as f:
                    from datetime import datetime
                    f.write(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
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


# ═══ TELOS IDEA FILE WATCHER ═══
# Watches for telos_ideas_batch.json (array of 5 ideas) and auto-inserts into telos_ideas table

TELOS_BATCH_FILE = os.path.join(REPO_DIR, 'stuart-hollinger-landing', 'prompt-server', 'telos_ideas_batch.json')
TELOS_SINGLE_FILE = os.path.join(REPO_DIR, 'stuart-hollinger-landing', 'prompt-server', 'telos_idea_output.json')

def check_telos_idea_files():
    """Check if Antigravity wrote idea JSON files, parse and insert into telos_ideas."""
    import json as json_module
    
    # Check for batch file first (5 ideas)
    if os.path.exists(TELOS_BATCH_FILE):
        try:
            with open(TELOS_BATCH_FILE, 'r', encoding='utf-8') as f:
                ideas = json_module.load(f)
            
            if isinstance(ideas, list) and len(ideas) > 0:
                print(f'[TELOS] 📥 Found batch file with {len(ideas)} ideas!')
                
                # Get batch_id from first idea or generate one
                batch_id = ideas[0].get('batch_id', str(int(time.time())))
                
                if TELOS_AVAILABLE:
                    inserted = telos.insert_batch_ideas(ideas, batch_id)
                    print(f'[TELOS] ✅ Queued {inserted}/{len(ideas)} ideas for approval')
                
                # Delete the file after processing
                os.remove(TELOS_BATCH_FILE)
                return True
            else:
                print('[TELOS] ⚠️ Batch file empty or invalid')
                os.remove(TELOS_BATCH_FILE)
                
        except json_module.JSONDecodeError as e:
            print(f'[TELOS] ⚠️ Invalid JSON in batch file: {e}')
            if os.path.exists(TELOS_BATCH_FILE):
                backup = TELOS_BATCH_FILE + '.bad.' + str(int(time.time()))
                os.rename(TELOS_BATCH_FILE, backup)
        except Exception as e:
            print(f'[TELOS] ⚠️ Error processing batch file: {e}')
            if os.path.exists(TELOS_BATCH_FILE):
                os.remove(TELOS_BATCH_FILE)
    
    # Also check for single idea file (backwards compatibility)
    if os.path.exists(TELOS_SINGLE_FILE):
        try:
            with open(TELOS_SINGLE_FILE, 'r', encoding='utf-8') as f:
                idea_data = json_module.load(f)
            
            print(f'[TELOS] 📥 Found single idea file: {idea_data.get("name", "Unknown")}')
            
            if not idea_data.get('name'):
                print('[TELOS] ⚠️ Invalid idea - no name')
                os.remove(TELOS_SINGLE_FILE)
                return False
            
            if TELOS_AVAILABLE:
                success = telos.insert_pending_idea(idea_data)
                if success:
                    print(f'[TELOS] ✅ Idea queued for approval: {idea_data.get("name")}')
                    os.remove(TELOS_SINGLE_FILE)
                    return True
            
            os.remove(TELOS_SINGLE_FILE)
            
        except json_module.JSONDecodeError as e:
            print(f'[TELOS] ⚠️ Invalid JSON in single file: {e}')
            if os.path.exists(TELOS_SINGLE_FILE):
                backup = TELOS_SINGLE_FILE + '.bad.' + str(int(time.time()))
                os.rename(TELOS_SINGLE_FILE, backup)
        except Exception as e:
            print(f'[TELOS] ⚠️ Error processing single file: {e}')
            if os.path.exists(TELOS_SINGLE_FILE):
                os.remove(TELOS_SINGLE_FILE)
    
    return False


# ═══ STAGED BUILD WORKER ═══
# Manages 50-prompt staged builds with bug loops

def check_staged_builds():
    """
    Check for approved ideas that need building.
    Generates next prompt in the staged build sequence.
    Returns a prompt if one is ready, None otherwise.
    """
    if not TELOS_AVAILABLE:
        return None
    
    try:
        # Find ideas with status='approved' OR 'building' (resume in-progress builds)
        response = requests.get(
            f'{SUPABASE_URL}/rest/v1/telos_ideas?status=in.(approved,building)&order=approved_at.asc&limit=1',
            headers={'apikey': SUPABASE_KEY},
            timeout=10
        )
        
        if response.status_code != 200:
            return None
        
        ideas = response.json()
        if not ideas:
            return None
        
        idea = ideas[0]
        idea_id = idea['id']
        app_name = idea.get('name', 'UnnamedApp')
        stored_iterations = idea.get('build_iterations', 0) or 0  # Resume from stored progress
        
        # Get or create builder (with resume support)
        app_slug = app_name.lower().replace(' ', '-').replace("'", "")
        app_path = os.path.join(REPO_DIR, 'apps', app_slug)
        
        build_instance = builder.get_or_create_builder(idea_id, app_name, app_path, stored_iterations)
        
        # Get next prompt
        prompt_text, prompt_type = build_instance.get_next_prompt(idea)
        
        if prompt_type == 'complete':
            # Build is done!
            builder.mark_build_complete(idea_id)
            builder.remove_builder(idea_id)
            print(f'[STAGED] 🎉 Build complete: {app_name}')
            return None
        
        if prompt_text:
            # Update progress in DB
            progress = build_instance.get_progress()
            builder.update_build_progress(idea_id, progress['prompt_count'], progress['stage'], 'building')
            
            # Write progress file
            build_instance.write_progress_file()
            
            print(f'[STAGED] 📝 Prompt {progress["prompt_count"]}/50 for {app_name} ({prompt_type})')
            
            return {
                'prompt': prompt_text,
                'idea_id': idea_id,
                'app_name': app_name,
                'prompt_type': prompt_type,
                'prompt_count': progress['prompt_count']
            }
        
        return None
        
    except Exception as e:
        print(f'[STAGED] Error: {e}')
        return None


def check_build_complete_file():
    """Check if Antigravity wrote a build_complete.json file for any active build."""
    if not TELOS_AVAILABLE:
        return
    
    for idea_id, build_instance in list(builder.active_builds.items()):
        complete_file = os.path.join(build_instance.app_path, 'build_complete.json')
        
        if os.path.exists(complete_file):
            try:
                with open(complete_file, 'r') as f:
                    data = json.load(f)
                
                print(f'[STAGED] 🎉 Build complete detected: {build_instance.app_name}')
                
                # ═══ VERCEL DEPLOYMENT ═══
                # Deploy the app to Vercel and get production URL
                try:
                    import vercel_deployer
                    print(f'[VERCEL] Deploying {build_instance.app_name} to Vercel...')
                    
                    deploy_result = vercel_deployer.deploy_app(
                        build_instance.app_path,
                        build_instance.app_name
                    )
                    
                    if deploy_result.get('success'):
                        prod_url = deploy_result['url']
                        print(f'[VERCEL] ✅ Deployed: {prod_url}')
                        
                        # Update Supabase with production URL
                        try:
                            response = requests.patch(
                                f'{SUPABASE_URL}/rest/v1/suite_apps?id=eq.{idea_id}',
                                headers={
                                    'apikey': SUPABASE_KEY,
                                    'Authorization': f'Bearer {SUPABASE_KEY}',
                                    'Content-Type': 'application/json'
                                },
                                json={
                                    'download_url': prod_url,
                                    'app_url': prod_url,
                                    'status': 'published'
                                }
                            )
                            if response.ok:
                                print(f'[SUPABASE] ✅ Updated app URL: {prod_url}')
                            else:
                                print(f'[SUPABASE] ⚠️ Failed to update URL: {response.text}')
                        except Exception as e:
                            print(f'[SUPABASE] ⚠️ Error updating URL: {e}')
                    else:
                        error_msg = deploy_result.get('error', 'Unknown error')
                        print(f'[VERCEL] ❌ Deployment failed: {error_msg}')
                        
                except ImportError:
                    print('[VERCEL] ⚠️ vercel_deployer module not found - skipping deployment')
                except Exception as e:
                    print(f'[VERCEL] ❌ Deployment error: {e}')
                
                builder.mark_build_complete(idea_id)
                builder.remove_builder(idea_id)
                
                # Archive the file
                os.rename(complete_file, complete_file + '.archived')
                
            except Exception as e:
                print(f'[STAGED] Error reading complete file: {e}')


# ═══ BACKGROUND PUSH THREAD ═══
# Runs continuously - handles accept sweeps and git push every 60s when idle

def background_push_worker():
    """Background thread that handles Accept sweeps and periodic git push"""
    push_interval = 60  # Push every 60 seconds
    accept_interval = 5  # Accept sweep every 5 seconds
    idle_threshold = 15  # Only push if no typing for 15 seconds
    
    last_push_time = time.time()
    last_accept_time = 0
    
    print('[BACKGROUND] Push worker started - will sync every 60s when idle')
    
    while True:
        try:
            current_time = time.time()
            
            # Accept sweep every 5 seconds - BUT ONLY if NO slots are typing AND not paused
            # Clicking any window steals focus, which breaks typewrite
            if current_time - last_accept_time >= accept_interval:
                if paused or prompt_incoming or any(slot_typing):
                    # Paused, prompt incoming, or someone is typing - don't click anything!
                    pass
                else:
                    # Safe to sweep all windows
                    for i, slot in enumerate(WINDOW_SLOTS):
                        # Check if prompt arrived mid-sweep - ABORT immediately
                        if prompt_incoming:
                            break
                        try:
                            # Click Accept button
                            pyautogui.click(slot["accept_x"], slot["accept_y"])
                            time.sleep(0.05)
                            # Click Retry button (in case of error)
                            pyautogui.click(slot["retry_x"], slot["retry_y"])
                            time.sleep(0.05)
                            # Press Alt+Enter for command dialogs
                            pyautogui.hotkey('alt', 'Return')
                            time.sleep(0.1)
                            # Click HIGHER in chat area (200px above input) to focus scrollable area
                            scroll_y = slot["chat_y"] - 200
                            pyautogui.click(slot["chat_x"], scroll_y)
                            time.sleep(0.15)  # Longer delay for focus to register
                            pyautogui.scroll(-500)  # 50x more scroll to see latest content
                        except:
                            pass
                    last_accept_time = current_time
            
            # Push every 60 seconds if no slots are typing
            if current_time - last_push_time >= push_interval:
                # Check if any slot is typing
                if any(slot_typing):
                    # Wait for typing to finish
                    pass
                else:
                    # Safe to push
                    print('[BACKGROUND] 60s passed - syncing to GitHub...')
                    with git_lock:
                        git_pull()
                        git_push()
                    last_push_time = current_time
                    print('[BACKGROUND] ✅ Sync complete')
            
            # ═══ TELOS IDEA CHECK ═══
            # Check if Antigravity wrote idea JSON files (batch or single)
            if TELOS_AVAILABLE:
                check_telos_idea_files()
                check_build_complete_file()
            
            # ═══ STAGED BUILD CHECK (every 30 seconds) ═══
            # Check if there are approved ideas that need staged build prompts
            if TELOS_AVAILABLE and not paused and current_time % 30 < 1:
                staged_prompt = check_staged_builds()
                if staged_prompt:
                    # Insert the staged prompt into the queue
                    try:
                        requests.post(
                            f'{SUPABASE_URL}/rest/v1/prompts',
                            headers={
                                'apikey': SUPABASE_KEY,
                                'Authorization': f'Bearer {SUPABASE_KEY}',
                                'Content-Type': 'application/json'
                            },
                            json={
                                'prompt': staged_prompt['prompt'],
                                'status': 'pending',
                                'prompt_type': 'telos_build',
                                'source': f"TELOS Staged Build [{staged_prompt['prompt_count']}/50]",
                                'metadata': json.dumps({
                                    'idea_id': staged_prompt['idea_id'],
                                    'app_name': staged_prompt['app_name'],
                                    'stage_type': staged_prompt['prompt_type'],
                                    'prompt_count': staged_prompt['prompt_count']
                                })
                            },
                            timeout=10
                        )
                        print(f'[STAGED] ✅ Queued prompt {staged_prompt["prompt_count"]}/50')
                    except Exception as e:
                        print(f'[STAGED] Failed to queue prompt: {e}')
            
            # ═══ AUTONOMOUS APP CREATION ═══
            # When toggled ON: immediately starts, then runs every 5 mins while enabled
            # When toggled OFF: stops generating new ideas (but finishes current builds)
            if TELOS_AVAILABLE and not paused:
                # Check if autonomous mode is enabled (every 10 seconds to not spam DB)
                if int(current_time) % 10 < 1:
                    is_enabled_now = telos.is_enabled()
                    
                    # Track state change in a module-level variable
                    if not hasattr(check_staged_builds, 'was_enabled'):
                        check_staged_builds.was_enabled = False
                        check_staged_builds.last_generation = 0
                    
                    was_enabled = check_staged_builds.was_enabled
                    
                    # Detect toggle ON → immediately start
                    if is_enabled_now and not was_enabled:
                        print('[AUTONOMOUS] 🟢 Mode ENABLED - starting app creation...')
                        check_staged_builds.was_enabled = True
                        
                        # Log to activity feed
                        telos.log_activity('telos_on', 'Autonomous mode ENABLED - starting app creation')
                        
                        # Immediately trigger idea generation
                        try:
                            can_generate, reason = telos.check_limits()
                            if can_generate:
                                print('[AUTONOMOUS] 🤖 Generating 5 app ideas...')
                                telos.run_telos_cycle()
                                check_staged_builds.last_generation = current_time
                            else:
                                print(f'[AUTONOMOUS] ⏳ Waiting: {reason}')
                        except Exception as e:
                            print(f'[AUTONOMOUS] Error: {e}')
                    
                    # Detect toggle OFF → stop
                    elif not is_enabled_now and was_enabled:
                        print('[AUTONOMOUS] 🔴 Mode DISABLED - stopping new ideas')
                        check_staged_builds.was_enabled = False
                        
                        # Log to activity feed
                        telos.log_activity('telos_off', 'Autonomous mode DISABLED - stopping new ideas')
                    
                    # While enabled: generate every 5 minutes if idle
                    elif is_enabled_now:
                        time_since_last = current_time - check_staged_builds.last_generation
                        if time_since_last > 300:  # 5 minutes
                            try:
                                # Check if idle (no pending, no building)
                                pending_resp = requests.get(
                                    f'{SUPABASE_URL}/rest/v1/telos_ideas?status=eq.pending&select=id&limit=1',
                                    headers={'apikey': SUPABASE_KEY}, timeout=5
                                )
                                building_resp = requests.get(
                                    f'{SUPABASE_URL}/rest/v1/telos_ideas?status=eq.building&select=id&limit=1',
                                    headers={'apikey': SUPABASE_KEY}, timeout=5
                                )
                                has_pending = pending_resp.ok and len(pending_resp.json()) > 0
                                has_building = building_resp.ok and len(building_resp.json()) > 0
                                
                                if not has_pending and not has_building:
                                    can_generate, reason = telos.check_limits()
                                    if can_generate:
                                        print('[AUTONOMOUS] 🤖 System idle - generating 5 new ideas...')
                                        telos.run_telos_cycle()
                                        check_staged_builds.last_generation = current_time
                            except Exception:
                                pass
            
            time.sleep(1)  # Check every second
            
        except Exception as e:
            print(f'[BACKGROUND] Error: {e}')
            time.sleep(5)


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
    
    # ═══ RECOVERY: Reset orphaned prompts from previous run ═══
    # If bot was stopped mid-way, reset 'processing' and 'sent' back to 'pending'
    print('[RECOVERY] Checking for orphaned prompts...')
    try:
        # Reset processing prompts
        response = requests.patch(
            f'{SUPABASE_URL}/rest/v1/prompts?status=in.(processing,sent)',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            },
            json={'status': 'pending'}
        )
        if response.ok:
            # Check how many were reset
            check = requests.get(
                f'{SUPABASE_URL}/rest/v1/prompts?status=eq.pending&select=id',
                headers={'apikey': SUPABASE_KEY}
            )
            pending_count = len(check.json()) if check.ok else 0
            if pending_count > 0:
                print(f'[RECOVERY] ✓ Reset orphaned prompts. {pending_count} pending.')
            else:
                print('[RECOVERY] ✓ No orphaned prompts found.')
        
        # telos_ideas in 'building' status will now RESUME automatically
        # (check_staged_builds looks for both 'approved' AND 'building')
        # Check how many are in progress
        response2 = requests.get(
            f'{SUPABASE_URL}/rest/v1/telos_ideas?status=eq.building&select=id,name,build_iterations',
            headers={'apikey': SUPABASE_KEY}
        )
        if response2.ok:
            building = response2.json()
            if building:
                for b in building:
                    print(f'[RECOVERY] ♻️ Will resume: {b.get("name")} at prompt {b.get("build_iterations", 0)}/50')
    except Exception as e:
        print(f'[RECOVERY] Warning: Could not check orphans: {e}')
    
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
    
    # Start background push thread (handles accept sweeps + periodic git sync)
    push_thread = threading.Thread(target=background_push_worker, daemon=True)
    push_thread.start()
    
    try:
        while True:
            # Check for pause (spacebar toggle or file)
            if paused or os.path.exists(PAUSE_FILE):
                time.sleep(1)
                continue
            
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
                # TELOS MODE: Generate autonomous app when queue is empty
                if TELOS_AVAILABLE and telos.is_enabled():
                    can_run, reason = telos.check_limits()
                    if can_run:
                        print(f'\n[TELOS] Queue empty - generating autonomous app...')
                        if telos.run_telos_cycle():
                            print(f'[TELOS] ✅ App prompt inserted - will process on next poll')
                        else:
                            print(f'[TELOS] ⚠️ Generation failed, will retry later')
                    else:
                        status = window_manager.status()
                        print(f'\r[POLL] No prompts | TELOS: {reason} | {status}', end='', flush=True)
                else:
                    status = window_manager.status()
                    print(f'\r[POLL] No pending prompts | {status}', end='', flush=True)
            
            time.sleep(POLL_INTERVAL)
            
    except KeyboardInterrupt:
        print('\n\n[STOPPED] Watcher stopped.')


if __name__ == '__main__':
    main()
