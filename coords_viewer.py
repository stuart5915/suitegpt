from PIL import Image, ImageTk
import tkinter as tk

# Open the image
img_path = r"C:\Users\info\.gemini\antigravity\brain\e7701cad-437e-43b8-90e4-3d48d2f5974b\uploaded_image_1768115794973.png"
img = Image.open(img_path)

# Create window
root = tk.Tk()
root.title("Click to get coordinates!")

# Create canvas
canvas = tk.Canvas(root, width=img.width, height=img.height)
canvas.pack()

# Display image
photo = ImageTk.PhotoImage(img)
canvas.create_image(0, 0, anchor='nw', image=photo)

# Coordinate label
coord_label = tk.Label(root, text="Hover over image - click to copy coords", font=("Arial", 14))
coord_label.pack()

# Store clicked coords
clicked_coords = []

def on_motion(event):
    coord_label.config(text=f"Position: ({event.x}, {event.y})")

def on_click(event):
    clicked_coords.append((event.x, event.y))
    print(f"Clicked: ({event.x}, {event.y})")
    coord_label.config(text=f"SAVED: ({event.x}, {event.y}) - {len(clicked_coords)} points captured")

canvas.bind('<Motion>', on_motion)
canvas.bind('<Button-1>', on_click)

print("Move mouse over image to see coordinates.")
print("Click to save coordinates (printed to console).")
print("Close window when done.")

root.mainloop()

print("\n=== All clicked coordinates ===")
for i, coord in enumerate(clicked_coords):
    print(f"{i+1}. {coord}")
