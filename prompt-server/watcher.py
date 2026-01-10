# Multi-Window Prompt Watcher - Cycles between multiple Antigravity windows
# 
# SETUP:
#   pip install pyautogui pyperclip watchdog pygetwindow
#
# USAGE:
#   1. Open 2-3 Antigravity IDE windows on your PC (duplicate workspace)
#   2. Run: python watcher.py
#   3. Send prompts from laptop via http://10.0.0.142:3000
#   4. Watcher cycles through windows automatically!

import os
import sys
import time
import threading
import pyautogui
import pyperclip
import subprocess
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from collections import deque

try:
    import pygetwindow as gw
except ImportError:
    print("Installing pygetwindow...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'pygetwindow'])
    import pygetwindow as gw

# Configuration
PROMPTS_DIR = os.path.join(os.path.dirname(__file__), 'prompts')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), 'processed')
REPO_DIR = r'C:\Users\Stuart\stuart-hollinger-landing'
WAIT_TIME_AFTER_PROMPT = 45  # Seconds to wait for AI to respond

# Create directories if needed
os.makedirs(PROMPTS_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Disable PyAutoGUI fail-safe for smoother operation
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1


class WindowManager:
    """Manages multiple Antigravity windows and cycles through them"""
    
    def __init__(self):
        self.windows = []
        self.current_index = 0
        self.busy_windows = set()  # Track which windows are processing
        self.lock = threading.Lock()
    
    def refresh_windows(self):
        """Find all Antigravity windows"""
        self.windows = []
        
        # Try different window title patterns
        patterns = ['Antigravity', 'idx', 'Google Antigravity', 'stuart-hollinger']
        
        for pattern in patterns:
            try:
                found = gw.getWindowsWithTitle(pattern)
                for w in found:
                    if w not in self.windows and w.visible:
                        self.windows.append(w)
            except:
                pass
        
        # Remove duplicates
        seen_titles = set()
        unique_windows = []
        for w in self.windows:
            if w.title not in seen_titles:
                seen_titles.add(w.title)
                unique_windows.append(w)
        self.windows = unique_windows
        
        return len(self.windows)
    
    def get_next_available_window(self):
        """Get the next available (not busy) window in round-robin fashion"""
        with self.lock:
            self.refresh_windows()
            
            if not self.windows:
                return None
            
            # Try to find an available window
            for _ in range(len(self.windows)):
                window = self.windows[self.current_index]
                self.current_index = (self.current_index + 1) % len(self.windows)
                
                if id(window) not in self.busy_windows:
                    return window
            
            # All windows busy, return the next one anyway (will queue)
            window = self.windows[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.windows)
            return window
    
    def mark_busy(self, window):
        """Mark a window as busy"""
        with self.lock:
            self.busy_windows.add(id(window))
    
    def mark_available(self, window):
        """Mark a window as available"""
        with self.lock:
            self.busy_windows.discard(id(window))
    
    def get_status(self):
        """Get current status"""
        self.refresh_windows()
        return {
            'total': len(self.windows),
            'busy': len(self.busy_windows),
            'available': len(self.windows) - len(self.busy_windows)
        }


# Global window manager
window_manager = WindowManager()


class PromptHandler(FileSystemEventHandler):
    def __init__(self):
        self.queue = deque()
        self.processing_lock = threading.Lock()
    
    def on_created(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith('.txt'):
            time.sleep(0.5)  # Wait for file to be written
            self.queue.append(event.src_path)
            self.process_queue()
    
    def process_queue(self):
        """Process prompts from the queue"""
        while self.queue:
            filepath = self.queue.popleft()
            threading.Thread(target=self.process_prompt, args=(filepath,)).start()
    
    def process_prompt(self, filepath):
        filename = os.path.basename(filepath)
        
        try:
            # Read the prompt
            with open(filepath, 'r', encoding='utf-8') as f:
                prompt = f.read().strip()
            
            # Get next available window
            window = window_manager.get_next_available_window()
            
            if not window:
                print(f'[ERROR] No Antigravity windows found! Open Antigravity on your PC.')
                return
            
            window_manager.mark_busy(window)
            
            print(f'\n{"="*60}')
            print(f'[NEW PROMPT] {filename}')
            print(f'[WINDOW] {window.title[:50]}...')
            print(f'{"="*60}')
            print(f'{prompt[:100]}...' if len(prompt) > 100 else prompt)
            print(f'{"="*60}\n')
            
            # Inject into the selected window
            self.inject_into_window(window, prompt)
            
            # Move to processed folder
            processed_path = os.path.join(PROCESSED_DIR, filename)
            if os.path.exists(filepath):
                os.rename(filepath, processed_path)
            print(f'[DONE] Moved to processed/')
            
            window_manager.mark_available(window)
            
        except Exception as e:
            print(f'[ERROR] Failed to process {filename}: {e}')
            if window:
                window_manager.mark_available(window)
    
    def inject_into_window(self, window, prompt):
        """Inject prompt into a specific Antigravity window"""
        try:
            # Activate the window
            window.activate()
            window.maximize()
            time.sleep(0.5)
            print(f'[ACTION] Activated: {window.title[:40]}...')
        except Exception as e:
            print(f'[WARNING] Could not activate window: {e}')
        
        # Pull latest changes first
        self.git_pull()
        
        # Copy prompt to clipboard
        pyperclip.copy(prompt)
        print('[ACTION] Copied prompt to clipboard')
        
        # Click in chat area (adjust coordinates as needed)
        screen_width, screen_height = pyautogui.size()
        
        # Try clicking in the chat input area (usually bottom center)
        chat_x = screen_width // 2
        chat_y = screen_height - 120
        
        pyautogui.click(chat_x, chat_y)
        time.sleep(0.3)
        
        # Paste the prompt
        pyautogui.hotkey('ctrl', 'v')
        print('[ACTION] Pasted prompt')
        time.sleep(0.2)
        
        # Press Enter to send
        pyautogui.press('enter')
        print('[ACTION] Sent prompt!')
        
        # Wait for AI to process
        print(f'[WAITING] Waiting {WAIT_TIME_AFTER_PROMPT}s for AI response...')
        time.sleep(WAIT_TIME_AFTER_PROMPT)
        
        # Auto-push to GitHub
        self.git_push()
    
    def git_pull(self):
        """Pull latest changes before processing"""
        print('[GIT] Pulling latest changes...')
        try:
            os.chdir(REPO_DIR)
            result = subprocess.run(['git', 'pull', '--rebase'], capture_output=True, text=True)
            if 'Already up to date' not in result.stdout:
                print(f'[GIT] Pulled changes')
        except Exception as e:
            print(f'[GIT] Pull error: {e}')
    
    def git_push(self):
        """Push changes to GitHub"""
        print('[GIT] Pushing changes...')
        try:
            os.chdir(REPO_DIR)
            subprocess.run(['git', 'add', '-A'], check=True)
            result = subprocess.run(
                ['git', 'commit', '-m', 'Auto-commit from PC prompt watcher'],
                capture_output=True, text=True
            )
            if 'nothing to commit' not in result.stdout:
                subprocess.run(['git', 'push', 'origin', 'master'], check=True)
                print('[GIT] Push successful!')
            else:
                print('[GIT] Nothing to commit')
        except subprocess.CalledProcessError as e:
            print(f'[GIT] Push failed or nothing to commit')
        except Exception as e:
            print(f'[GIT] Error: {e}')


def main():
    # Initial window detection
    count = window_manager.refresh_windows()
    
    print('=' * 60)
    print('MULTI-WINDOW PROMPT WATCHER')
    print('=' * 60)
    print(f'Watching: {PROMPTS_DIR}')
    print(f'Found {count} Antigravity window(s)')
    print('')
    print('SETUP CHECKLIST:')
    print('  [ ] Open 2-3 Antigravity windows (duplicate workspace)')
    print('  [ ] Keep this script running')
    print('  [ ] Send prompts from http://10.0.0.142:3000')
    print('')
    print('The watcher will cycle through windows automatically!')
    print('Press Ctrl+C to stop')
    print('=' * 60)
    
    if count == 0:
        print('\n⚠️  WARNING: No Antigravity windows detected!')
        print('    Open Antigravity IDE and this script will detect it.\n')
    
    # Process any existing prompts
    existing = sorted(Path(PROMPTS_DIR).glob('*.txt'))
    if existing:
        print(f'\n[STARTUP] Found {len(existing)} pending prompts')
        handler = PromptHandler()
        for f in existing:
            handler.queue.append(str(f))
        handler.process_queue()
    
    # Start watching for new prompts
    event_handler = PromptHandler()
    observer = Observer()
    observer.schedule(event_handler, PROMPTS_DIR, recursive=False)
    observer.start()
    
    try:
        while True:
            # Periodically refresh and show status
            status = window_manager.get_status()
            print(f'\r[STATUS] Windows: {status["total"]} total, {status["busy"]} busy, {status["available"]} available', end='')
            time.sleep(5)
    except KeyboardInterrupt:
        observer.stop()
        print('\n\n[STOPPED] Watcher stopped.')
    
    observer.join()


if __name__ == '__main__':
    main()
