#!/usr/bin/env python3
"""
Change favicon from suite-mascot.png to suite-token.png across all pages
Handles encoding issues gracefully
"""

import os

# Fix docs pages
docs_dir = 'docs'
fixed_count = 0

for filename in os.listdir(docs_dir):
    if not filename.endswith('.html'):
        continue
    
    filepath = os.path.join(docs_dir, filename)
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        original = content
        content = content.replace('href="../assets/suite-mascot.png"', 'href="../assets/suite-token.png"')
        content = content.replace('href="assets/suite-mascot.png"', 'href="../assets/suite-token.png"')
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: docs/{filename}")
            fixed_count += 1
    except Exception as e:
        print(f"Error with docs/{filename}: {e}")

# Fix root-level HTML pages  
for filename in os.listdir('.'):
    if not filename.endswith('.html'):
        continue
    try:
        with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        original = content
        content = content.replace('href="assets/suite-mascot.png"', 'href="assets/suite-token.png"')
        
        if content != original:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {filename}")
            fixed_count += 1
    except Exception as e:
        print(f"Error with {filename}: {e}")

print(f"\nTotal files updated: {fixed_count}")
