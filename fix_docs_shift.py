#!/usr/bin/env python3
"""
Fix the docs pages that are shifted right by adding 'margin: 0 auto' to .docs-container
"""

import os

docs_dir = 'docs'
files_to_fix = ['publish-checklist.html', 'how-it-works.html', 'utility.html']

for filename in files_to_fix:
    filepath = os.path.join(docs_dir, filename)
    if not os.path.exists(filepath):
        print(f"{filename}: NOT FOUND")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # The fix: Add 'margin: 0 auto;' to .docs-container
    # Current pattern ends with 'gap: 30px;' or 'gap: 40px;'
    # Need to add margin: 0 auto; before the closing brace
    
    # Look for .docs-container { ... max-width: 1200px; ... } and add margin
    if 'margin: 0 auto' in content:
        print(f"{filename}: Already has margin: 0 auto")
        continue
    
    # Find and replace the docs-container CSS
    # Add margin: 0 auto after max-width: 1200px
    old_pattern = 'max-width: 1200px;'
    new_pattern = 'max-width: 1200px;\n            margin: 0 auto;'
    
    if old_pattern in content:
        content = content.replace(old_pattern, new_pattern, 1)  # Only first occurrence in .docs-container
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"{filename}: Added margin: 0 auto to .docs-container")
    else:
        print(f"{filename}: Could not find pattern to fix")
