"""
Mouse Position Highlighter
Shows current mouse coordinates in real-time
Press Ctrl+C to stop
"""
import pyautogui
import time

print("=" * 50)
print("MOUSE POSITION HIGHLIGHTER")
print("=" * 50)
print("Move your mouse to each corner of your Antigravity windows")
print("and note the coordinates.")
print("")
print("Press Ctrl+C to stop")
print("=" * 50)
print("")

try:
    while True:
        x, y = pyautogui.position()
        print(f"\rMouse Position: X={x:4d}, Y={y:4d}    ", end="", flush=True)
        time.sleep(0.1)
except KeyboardInterrupt:
    print("\n\nStopped!")
    print("\nNow update watcher.py SLOT_COORDINATES with your values:")
    print("""
SLOT_COORDINATES = {
    0: {'x': ???, 'y': ???},  # Top-left window
    1: {'x': ???, 'y': ???},  # Top-right window
    2: {'x': ???, 'y': ???},  # Bottom-left window
    3: {'x': ???, 'y': ???},  # Bottom-right window
}
""")
