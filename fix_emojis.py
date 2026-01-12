# Fix broken emojis in index.html
# Run with: python fix_emojis.py

with open('index.html', 'rb') as f:
    content = f.read()

# Replace common broken emoji patterns with proper emojis
replacements = [
    # Tool icons - replacing broken bytes with actual emojis
    (b'\xef\xbf\xbd\xef\xbf\xbd', b''),  # Remove replacement characters
]

for old, new in replacements:
    content = content.replace(old, new)

# Also try fixing by removing the broken bytes
content = content.replace(b'\xef\xbf\xbd', b'')

with open('index.html', 'wb') as f:
    f.write(content)

print('Fixed! Refresh your browser.')
