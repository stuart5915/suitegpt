#!/usr/bin/env python3
"""Analyze and fix dashboard.html container structure issues"""

with open('dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

# Find key structural elements
print("Analyzing dashboard.html structure...")
print(f"Total lines: {len(lines)}")

# Look for container and panel patterns
containers = []
panels = []
sections = []

for i, line in enumerate(lines):
    if 'dashboard-container' in line or 'main-content' in line:
        containers.append((i+1, line.strip()[:80]))
    if 'panel-' in line and ('id=' in line or 'class=' in line):
        panels.append((i+1, line.strip()[:80]))
    if 'section-panel' in line:
        sections.append((i+1, line.strip()[:80]))

print("\n=== Containers ===")
for line_num, text in containers[:15]:
    print(f"Line {line_num}: {text}")

print("\n=== Section Panels ===")
for line_num, text in sections[:15]:
    print(f"Line {line_num}: {text}")

print("\n=== Panels (panel-*) ===")  
for line_num, text in panels[:20]:
    print(f"Line {line_num}: {text}")

# Check for closing div patterns around key areas
print("\n=== Looking for structure issues ===")
# Find mismatched div tags or early closures
