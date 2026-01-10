#!/usr/bin/env python3
"""Find the main container structure around line 830-900 in dashboard.html"""

with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("=== Lines 820-860 (around panel-overview) ===")
for i in range(819, min(860, len(lines))):
    print(f"{i+1}: {lines[i].rstrip()[:100]}")

print("\n=== Lines 880-910 (around panel-apps/treasury) ===")
for i in range(879, min(910, len(lines))):
    print(f"{i+1}: {lines[i].rstrip()[:100]}")
