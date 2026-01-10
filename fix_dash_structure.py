#!/usr/bin/env python3
"""
Fix dashboard.html structure - the panel-studio and panel-marketplace sections
are breaking out of the main container. They need proper indentation to be inside <main>.

The issue is that after line ~1418, the closing </div> tags reduce indentation too much,
causing subsequent panels to appear outside the main container.
"""

with open('dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# The fix: The panels that start with 4-space indentation (    <div id="panel-...)
# should have 16-space indentation (                <div id="panel-...) to be inside <main>

# Fix panel-studio section (currently at wrong indentation level)
old_studio = '    <!-- Content Studio Panel -->\n\n    <div id="panel-studio" class="section-panel">'
new_studio = '                <!-- Content Studio Panel -->\n                <div id="panel-studio" class="section-panel">'

if old_studio in content:
    content = content.replace(old_studio, new_studio)
    print("Fixed panel-studio indentation")
else:
    print("Could not find panel-studio pattern - checking alternative...")
    # Try alternative pattern
    old_studio2 = '    <div id="panel-studio" class="section-panel">'
    new_studio2 = '                <div id="panel-studio" class="section-panel">'
    if old_studio2 in content:
        content = content.replace(old_studio2, new_studio2)
        print("Fixed panel-studio indentation (alt pattern)")

# Fix panel-marketplace section  
old_marketplace = '    <!-- Content Marketplace Panel -->\n    <div id="panel-marketplace" class="section-panel">'
new_marketplace = '                <!-- Content Marketplace Panel -->\n                <div id="panel-marketplace" class="section-panel">'

if old_marketplace in content:
    content = content.replace(old_marketplace, new_marketplace)
    print("Fixed panel-marketplace indentation")
else:
    print("Could not find panel-marketplace pattern - checking alternative...")
    old_mp2 = '    <div id="panel-marketplace" class="section-panel">'
    new_mp2 = '                <div id="panel-marketplace" class="section-panel">'
    if old_mp2 in content:
        content = content.replace(old_mp2, new_mp2)
        print("Fixed panel-marketplace indentation (alt pattern)")

# Also need to fix the closing tags and interior content for these panels
# This is more complex - for now let's check if the issue is with container structure

# Actually, the real issue might be missing closing </main> or extra closing tags
# Let me check the structure around panel-giving

# Find and count the main structure
main_opens = content.count('<main')
main_closes = content.count('</main>')
print(f"\n<main> tags: {main_opens} opens, {main_closes} closes")

dashboard_main = content.count('dashboard-main')
print(f"dashboard-main occurrences: {dashboard_main}")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nStructure fixes applied!")
