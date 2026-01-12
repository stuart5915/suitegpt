# Fix the corrupted line and add Coming Soon overlay
with open('apps.html', 'r', encoding='latin-1') as f:
    lines = f.readlines()

# Fix line 1323 (index 1322)
if 'symbiosis-section' in lines[1322]:
    # Replace with clean version plus overlay - use HTML entity for emoji
    lines[1322] = '''            <div class="symbiosis-section" style="position: relative;">
                <!-- Coming Soon Overlay -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 20px; pointer-events: none;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">&#128640;</div>
                    <div style="font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, #ff9500, #ff6b9d); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Coming Soon</div>
                    <div style="color: #666; margin-top: 8px;">AI Fleet is under development</div>
                </div>
'''
    print("Fixed line 1323 and added Coming Soon overlay!")
else:
    print(f"Line 1323 content: {lines[1322][:80]}")

with open('apps.html', 'w', encoding='latin-1') as f:
    f.writelines(lines)

print("Done! Refresh browser.")
