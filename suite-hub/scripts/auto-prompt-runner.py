# IDE Auto-Prompt Runner v3
# Watches prompts folder and auto-types commands into Antigravity IDE
# Features:
#   - Only activates when there's a new prompt
#   - 5-minute auto-accept period for Accept dialogs
#   - PAUSE file to temporarily disable
#   - Mouse failsafe (top-left corner)

import os
import time
import sys
from datetime import datetime

try:
    import pyautogui
    import pygetwindow as gw
except ImportError:
    print("❌ Missing packages. Run: pip install pyautogui pygetwindow")
    sys.exit(1)

# Configuration
PROMPTS_FOLDER = r"C:\Users\info\.gemini\antigravity\scratch\stuart-hollinger-landing\suite-hub\prompts"
IDE_WINDOW_TITLE = "Antigravity"
COMMAND_TO_TYPE = "Process all prompts in the prompts folder"
CHECK_INTERVAL = 10  # Seconds between folder checks
COOLDOWN_AFTER_COMMAND = 120  # Seconds between commands
AUTO_ACCEPT_DURATION = 300  # 5 minutes of auto-accepting after command
PROCESSED_FILE = os.path.join(PROMPTS_FOLDER, ".processed_prompts.txt")
PAUSE_FILE = os.path.join(PROMPTS_FOLDER, "PAUSE")  # Create this file to pause

# Safety
pyautogui.FAILSAFE = True  # Move mouse to TOP-LEFT corner to abort
pyautogui.PAUSE = 0.5

last_command_time = 0

def log(message, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def is_paused():
    """Check if PAUSE file exists"""
    return os.path.exists(PAUSE_FILE)

def get_processed_files():
    try:
        if os.path.exists(PROCESSED_FILE):
            with open(PROCESSED_FILE, 'r') as f:
                return set(line.strip() for line in f if line.strip())
    except:
        pass
    return set()

def mark_as_processed(filename):
    try:
        with open(PROCESSED_FILE, 'a') as f:
            f.write(filename + '\n')
    except Exception as e:
        log(f"Error marking processed: {e}")

def find_ide_window():
    try:
        windows = gw.getWindowsWithTitle(IDE_WINDOW_TITLE)
        if windows:
            return windows[0]
    except:
        pass
    return None

def check_for_new_prompts():
    processed = get_processed_files()
    new_files = []
    try:
        if os.path.exists(PROMPTS_FOLDER):
            for f in os.listdir(PROMPTS_FOLDER):
                if f.endswith('.txt') and not f.startswith('.') and f not in processed:
                    new_files.append(f)
    except Exception as e:
        log(f"Error checking prompts: {e}")
    return new_files

def send_command_to_ide(new_files):
    global last_command_time
    
    # Check cooldown
    if time.time() - last_command_time < COOLDOWN_AFTER_COMMAND:
        remaining = int(COOLDOWN_AFTER_COMMAND - (time.time() - last_command_time))
        log(f"⏳ Cooldown: {remaining}s remaining")
        return False
    
    window = find_ide_window()
    if not window:
        log("❌ Antigravity window not found!")
        return False
    
    try:
        log(f"🎯 Found: {window.title}")
        window.activate()
        time.sleep(1)
        
        if not window.isActive:
            log("⚠️ Could not activate window")
            return False
        
        log("📝 Typing command...")
        pyautogui.typewrite(COMMAND_TO_TYPE, interval=0.03)
        time.sleep(0.5)
        pyautogui.press('enter')
        
        last_command_time = time.time()
        
        # Mark files as processed
        for f in new_files:
            mark_as_processed(f)
        log(f"✅ Sent! Processing {len(new_files)} prompt(s)")
        
        # Auto-accept loop (5 minutes)
        log(f"🔄 Auto-accepting for {AUTO_ACCEPT_DURATION//60} minutes...")
        accept_end = time.time() + AUTO_ACCEPT_DURATION
        accept_count = 0
        
        while time.time() < accept_end:
            # Check for pause
            if is_paused():
                log("⏸️ PAUSE file detected - stopping auto-accept")
                break
            
            try:
                # Only press if window is active
                current_window = find_ide_window()
                if current_window and current_window.isActive:
                    pyautogui.hotkey('alt', 'Return')
                    accept_count += 1
            except:
                pass
            
            time.sleep(3)
        
        log(f"✅ Done! Pressed Accept {accept_count} times")
        return True
        
    except Exception as e:
        log(f"❌ Error: {e}")
        return False

def main():
    print("""
╔════════════════════════════════════════════════════════════╗
║         🤖 Auto-Prompt Runner v3                            ║
║                                                            ║
║  ⏸️  CREATE 'PAUSE' FILE IN PROMPTS FOLDER TO PAUSE        ║
║  🛑 MOVE MOUSE TO TOP-LEFT CORNER TO ABORT                 ║
║  ⌨️  CTRL+C TO STOP                                        ║
╚════════════════════════════════════════════════════════════╝
    """)
    
    log(f"Watching: {PROMPTS_FOLDER}")
    log(f"Auto-accept: {AUTO_ACCEPT_DURATION//60} minutes after command")
    print()
    
    consecutive_failures = 0
    
    while True:
        try:
            # Check for pause
            if is_paused():
                log("⏸️ PAUSED - delete PAUSE file to resume")
                time.sleep(5)
                continue
            
            # Check for new prompts
            new_files = check_for_new_prompts()
            
            if new_files:
                log(f"🆕 New prompts: {new_files}")
                
                if send_command_to_ide(new_files):
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    if consecutive_failures >= 5:
                        log("🛑 Too many failures, waiting 5 min...")
                        time.sleep(300)
                        consecutive_failures = 0
            
            time.sleep(CHECK_INTERVAL)
            
        except KeyboardInterrupt:
            log("👋 Stopped (Ctrl+C)")
            break
        except pyautogui.FailSafeException:
            log("🛑 ABORT - Mouse in corner")
            break
        except Exception as e:
            log(f"Error: {e}")
            time.sleep(10)
    
    print("\n🔴 Runner stopped.")

if __name__ == "__main__":
    main()
