"""
Transparent overlay showing window slot positions
Run this alongside watcher.py to see where windows should be
"""
import tkinter as tk

# Same coordinates as watcher.py
WINDOW_SLOTS = [
    {"name": "1: Top-Left", "chat_x": 3228, "chat_y": 585, "accept_x": 3438, "accept_y": 553},
    {"name": "2: Top-Right", "chat_x": 4227, "chat_y": 594, "accept_x": 4415, "accept_y": 560},
    {"name": "3: Bottom-Left", "chat_x": 3207, "chat_y": 1154, "accept_x": 3441, "accept_y": 1119},
    {"name": "4: Bottom-Right", "chat_x": 4226, "chat_y": 1151, "accept_x": 4415, "accept_y": 1119},
]

def create_overlay():
    root = tk.Tk()
    root.title("Window Positions")
    
    # Make it cover all screens
    root.geometry("6000x2000+0+0")  # Large enough for multi-monitor
    root.configure(bg='black')
    root.attributes('-alpha', 0.3)  # Semi-transparent
    root.attributes('-topmost', True)  # Stay on top
    root.overrideredirect(True)  # No window decorations
    
    # Allow clicking through the window (Windows-specific)
    try:
        root.attributes('-transparentcolor', 'black')
    except:
        pass
    
    canvas = tk.Canvas(root, bg='black', highlightthickness=0)
    canvas.pack(fill='both', expand=True)
    
    # Draw markers for each slot
    for slot in WINDOW_SLOTS:
        # Chat input marker (green circle)
        cx, cy = slot['chat_x'], slot['chat_y']
        canvas.create_oval(cx-15, cy-15, cx+15, cy+15, outline='lime', width=3)
        canvas.create_text(cx, cy-30, text=f"Chat {slot['name']}", fill='lime', font=('Arial', 10, 'bold'))
        
        # Accept button marker (red circle)
        ax, ay = slot['accept_x'], slot['accept_y']
        canvas.create_oval(ax-15, ay-15, ax+15, ay+15, outline='red', width=3)
        canvas.create_text(ax, ay-30, text="Accept", fill='red', font=('Arial', 10, 'bold'))
    
    # Instructions
    canvas.create_text(3800, 50, text="Position your Antigravity windows so chat inputs align with GREEN circles", 
                       fill='white', font=('Arial', 14, 'bold'))
    canvas.create_text(3800, 80, text="Press ESC or click anywhere to close overlay", 
                       fill='gray', font=('Arial', 11))
    
    # Close on Escape or click
    root.bind('<Escape>', lambda e: root.destroy())
    root.bind('<Button-1>', lambda e: root.destroy())
    
    print("Overlay showing! Press ESC or click to close.")
    root.mainloop()

if __name__ == "__main__":
    print("=" * 50)
    print("WINDOW POSITION OVERLAY")
    print("=" * 50)
    print("Showing markers at configured positions...")
    print("GREEN = Chat input, RED = Accept button")
    print("Press ESC or click to close.")
    print("=" * 50)
    create_overlay()
