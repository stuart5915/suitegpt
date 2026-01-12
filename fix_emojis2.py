# Fix broken emojis in index.html - Version 2
# Run with: python fix_emojis2.py

with open('index.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Replace ?? patterns with proper emojis/icons
# Based on context from the screenshot:
# - React.js box should have React logo
# - chibi 2 box should have an icon
# - App Development Tools box should have a computer icon

# Find and replace broken emoji patterns
# Replace standalone ?? that appear to be broken emojis
import re

# Replace patterns like "??<space>" or "??<" with just empty or icon
content = re.sub(r'\?\?\s*(?=<)', '', content)  # ?? before HTML tags
content = re.sub(r'>\?\?<', '><', content)  # ?? between tags

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed! Refresh your browser.')
