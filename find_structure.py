#!/usr/bin/env python3
"""Find where </main> closes and check if panels are escaping the container"""

with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("=== Looking for </main> closing tags ===")
for i, line in enumerate(lines):
    if '</main>' in line:
        print(f"Line {i+1}: {line.rstrip()[:100]}")

print("\n=== Looking for </aside> closing tags ===")
for i, line in enumerate(lines):
    if '</aside>' in line:
        print(f"Line {i+1}: {line.rstrip()[:100]}")

print("\n=== Looking for dashboard-layout structure ===")
for i, line in enumerate(lines):
    if 'dashboard-layout' in line or 'dashboard-wrapper' in line:
        print(f"Line {i+1}: {line.rstrip()[:100]}")

# Find all section-panel divs and their approximate closing
print("\n=== Section panel locations ===")
panels = []
for i, line in enumerate(lines):
    if 'id="panel-' in line and 'class="section-panel' in line:
        panels.append((i+1, line.strip()[:80]))

for line_num, text in panels:
    print(f"Line {line_num}: {text}")

# Check last 100 lines for structure
print("\n=== Last 50 lines of body (structure check) ===")
body_end = len(lines) - 1
for i in range(body_end - 50, body_end):
    if i >= 0:
        line = lines[i].rstrip()
        if '</div>' in line or '</main>' in line or '</section>' in line or '</body>' in line or 'script' in line.lower():
            print(f"Line {i+1}: {line[:100]}")
