#!/usr/bin/env python3
"""Look at lines around the main closure and panel-giving/studio/marketplace"""

with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("=== Lines 1380-1440 (around panel-giving/studio) ===")
for i in range(1379, min(1440, len(lines))):
    line = lines[i].rstrip()
    if line.strip():  # Only non-empty lines
        print(f"{i+1}: {line[:100]}")

print("\n=== Lines 1670-1790 (around panel-marketplace and </main>) ===")
for i in range(1669, min(1790, len(lines))):
    line = lines[i].rstrip()
    if line.strip():  # Only non-empty lines
        print(f"{i+1}: {line[:100]}")
