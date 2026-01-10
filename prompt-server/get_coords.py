"""
Mouse Coordinate Finder
Run this and move your mouse around to see the coordinates.
Press Ctrl+C to stop.
"""
import pyautogui
import time

print("=" * 50)
print("MOUSE COORDINATE FINDER")
print("=" * 50)
print("Move your mouse to the spots you need.")
print("Note down the X and Y values.")
print("Press Ctrl+C to stop.")
print("=" * 50)

try:
    while True:
        x, y = pyautogui.position()
        print(f"\rX: {x:4d}  Y: {y:4d}   ", end="", flush=True)
        time.sleep(0.1)
except KeyboardInterrupt:
    print("\n\nDone!")
