# Add "Coming Soon" blur overlay to symbiosis-section in apps.html
# Run with: python add_coming_soon.py

with open('apps.html', 'rb') as f:
    content = f.read()

# Find symbiosis-section and add position:relative style
target1 = b'class="symbiosis-section"'
replace1 = b'class="symbiosis-section" style="position: relative;"'

if target1 in content:
    content = content.replace(target1, replace1, 1)
    print("Step 1: Added position:relative to symbiosis-section")
else:
    print("Could not find symbiosis-section class")

# Now add overlay right after the opening symbiosis-section div
# Find where the section starts and inject overlay
overlay = b'''
                <!-- Coming Soon Overlay -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 20px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">&#128640;</div>
                    <div style="font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, #ff9500, #ff6b9d); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Coming Soon</div>
                    <div style="color: #666; margin-top: 8px;">AI Fleet is under development</div>
                </div>
'''

# Insert after the position:relative we just added
insert_after = b'class="symbiosis-section" style="position: relative;">'
if insert_after in content:
    content = content.replace(insert_after, insert_after + overlay, 1)
    print("Step 2: Added Coming Soon overlay")
else:
    print("Could not find insertion point")

with open('apps.html', 'wb') as f:
    f.write(content)

print("Done! Refresh your browser.")
