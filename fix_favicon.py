#!/usr/bin/env python3
"""
Change favicon from suite-mascot.png to suite-token.png across all docs pages
"""

import os
import glob

# Fix docs pages
docs_dir = 'docs'
fixed_count = 0

for filename in os.listdir(docs_dir):
    if not filename.endswith('.html'):
        continue
    
    filepath = os.path.join(docs_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the old favicon with the new one
    # Pattern: href="assets/suite-mascot.png" or href="../assets/suite-mascot.png"
    original = content
    
    # For docs pages, the path is ../assets/
    content = content.replace('href="../assets/suite-mascot.png"', 'href="../assets/suite-token.png"')
    content = content.replace('href="assets/suite-mascot.png"', 'href="../assets/suite-token.png"')
    content = content.replace("href='../assets/suite-mascot.png'", "href='../assets/suite-token.png'")
    content = content.replace("href='assets/suite-mascot.png'", "href='../assets/suite-token.png'")
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: docs/{filename}")
        fixed_count += 1

# Also fix root-level HTML pages
root_files = [f for f in os.listdir('.') if f.endswith('.html')]
for filename in root_files:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    content = content.replace('href="assets/suite-mascot.png"', 'href="assets/suite-token.png"')
    content = content.replace("href='assets/suite-mascot.png'", "href='assets/suite-token.png'")
    
    if content != original:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {filename}")
        fixed_count += 1

print(f"\nTotal files updated: {fixed_count}")
