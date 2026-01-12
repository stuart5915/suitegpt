import re

# Read with binary to handle any encoding
with open('docs/sidebar.js', 'rb') as f:
    content = f.read()

# Replace systems-view.html with ecosystem.html for the Ecosystem link
content = content.replace(b'systems-view.html', b'ecosystem.html')

# Write back
with open('docs/sidebar.js', 'wb') as f:
    f.write(content)

print('Done! Ecosystem now links to ecosystem.html')
