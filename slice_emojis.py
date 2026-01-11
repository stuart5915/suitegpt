from PIL import Image
import os

# Source image path
src = r"C:\Users\info\.gemini\antigravity\brain\e7701cad-437e-43b8-90e4-3d48d2f5974b\uploaded_image_1768115794973.png"

# Output directory
out_dir = r"c:\Users\info\Documents\stuart-hollinger-landing\stuart-hollinger-landing\assets\emojis"
os.makedirs(out_dir, exist_ok=True)

# Clicked center coordinates (from user) - reordered to match left-to-right, top-to-bottom
centers = [
    # Row 1 (top): rocket, coins, book, sparkles, vault, heart-ribbon
    (106, 85), (275, 96), (429, 94), (594, 96), (756, 93), (921, 92),
    # Row 2 (middle): gear, heart-bow, target, house, cart, settings  
    (103, 277), (264, 273), (428, 277), (590, 285), (769, 273), (922, 278),
    # Row 3 (bottom): phone, smartphone, wrench, trophy, chat, lock
    (98, 463), (265, 463), (426, 463), (591, 456), (760, 459), (921, 473),
]

# Emoji names (matching the order above)
names = [
    # Row 1
    "rocket", "coins", "book", "sparkles", "vault", "heart-ribbon",
    # Row 2
    "gear", "heart-bow", "target", "house", "cart", "settings",
    # Row 3
    "phone", "smartphone", "wrench", "trophy", "chat", "lock"
]

# Crop size around each center (adjust if needed)
crop_size = 140  # 140px square around center

# Open image
img = Image.open(src)
print(f"Image size: {img.width}x{img.height}")
print(f"Crop size: {crop_size}x{crop_size} centered on each emoji")

half = crop_size // 2

for i, (cx, cy) in enumerate(centers):
    # Calculate crop box centered on the clicked point
    left = cx - half
    top = cy - half
    right = cx + half
    bottom = cy + half
    
    # Crop the emoji
    emoji = img.crop((left, top, right, bottom))
    
    # Save with descriptive name
    filename = f"clay-{names[i]}.png"
    filepath = os.path.join(out_dir, filename)
    emoji.save(filepath, "PNG")
    print(f"✅ Saved: {filename} (center: {cx}, {cy})")

print(f"\n🎉 Done! {len(names)} centered emojis saved to {out_dir}")
