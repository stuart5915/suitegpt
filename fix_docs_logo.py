#!/usr/bin/env python3
"""Fix nav logo path in docs/index.html"""

with open('docs/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the logo path - docs pages need ../ to go up one directory
content = content.replace('src="assets/suite-token.png"', 'src="../assets/suite-token.png"')

with open('docs/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed docs/index.html nav logo path!")
