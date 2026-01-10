"""
Window Position Highlighter
Briefly flashes circles at the configured click positions
so you know where to position your Antigravity windows.
"""
import pyautogui
import time

# Same coordinates as watcher.py
WINDOW_SLOTS = [
    {"name": "Top-Left", "chat_x": 3228, "chat_y": 585, "accept_x": 3438, "accept_y": 553},
    {"name": "Top-Right", "chat_x": 4227, "chat_y": 594, "accept_x": 4415, "accept_y": 560},
    {"name": "Bottom-Left", "chat_x": 3207, "chat_y": 1154, "accept_x": 3441, "accept_y": 1119},
    {"name": "Bottom-Right", "chat_x": 4226, "chat_y": 1151, "accept_x": 4415, "accept_y": 1119},
]

print("=" * 60)
print("WINDOW POSITION HIGHLIGHTER")
print("=" * 60)
print("The mouse will move to each configured position.")
print("Position your Antigravity windows so the clicks land correctly!")
print("Press Ctrl+C to stop.")
print("=" * 60)

try:
    for i, slot in enumerate(WINDOW_SLOTS):
        print(f"\n🔴 SLOT {i}: {slot['name']}")
        
        # Move to chat input position
        print(f"   Chat input: ({slot['chat_x']}, {slot['chat_y']})")
        pyautogui.moveTo(slot['chat_x'], slot['chat_y'])
        time.sleep(1.5)
        
        # Move to accept button position
        print(f"   Accept btn: ({slot['accept_x']}, {slot['accept_y']})")
        pyautogui.moveTo(slot['accept_x'], slot['accept_y'])
        time.sleep(1.5)
    
    print("\n✅ Done! Did the positions look correct?")
    print("If not, run get_coords.py to find new coordinates.")
    
except KeyboardInterrupt:
    print("\nStopped!")
