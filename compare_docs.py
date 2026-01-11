#!/usr/bin/env python3
"""Compare container/wrapper structure between docs pages to find the shift issue"""

import os

docs_dir = 'docs'
files_to_check = ['publish-checklist.html', 'how-it-works.html', 'utility.html', 'quickstart.html', 'index.html']

for filename in files_to_check:
    filepath = os.path.join(docs_dir, filename)
    if not os.path.exists(filepath):
        print(f"\n{filename}: NOT FOUND")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
    
    print(f"\n=== {filename} ===")
    
    # Look for container/wrapper structures
    for i, line in enumerate(lines[:150]):  # Check first 150 lines  
        if any(kw in line.lower() for kw in ['container', 'wrapper', 'main-content', 'docs-content', 'sidebar', '<main', '<body']):
            print(f"Line {i+1}: {line.strip()[:80]}")
