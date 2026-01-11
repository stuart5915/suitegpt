#!/usr/bin/env python3
"""Check the actual .docs-container CSS in each file"""

import os
import re

docs_dir = 'docs'
files_to_check = ['publish-checklist.html', 'how-it-works.html', 'utility.html', 'quickstart.html']

for filename in files_to_check:
    filepath = os.path.join(docs_dir, filename)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"\n=== {filename} ===")
    
    # Find .docs-container CSS block
    match = re.search(r'\.docs-container\s*\{([^}]+)\}', content)
    if match:
        css = match.group(1).strip()
        print(f".docs-container CSS:\n{css}")
    else:
        print("No .docs-container found")
    
    # Also check if there's margin-left on docs-content
    match2 = re.search(r'\.docs-content\s*\{([^}]+)\}', content)
    if match2:
        css2 = match2.group(1).strip()
        # Extract just margin and padding related
        for line in css2.split(';'):
            if 'margin' in line or 'padding' in line or 'width' in line:
                print(f".docs-content: {line.strip()}")
