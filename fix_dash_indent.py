#!/usr/bin/env python3
"""
More comprehensive fix for dashboard panel structure.
The entire panel-studio and panel-marketplace sections need their interior
lines re-indented to be properly inside <main>.

All lines from 4-space indent need to become 16-space indent within these panels.
"""

with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line numbers for panel-studio and panel-marketplace sections
studio_start = None
studio_end = None
marketplace_start = None
marketplace_end = None

for i, line in enumerate(lines):
    if 'panel-studio' in line and 'section-panel' in line:
        studio_start = i
    if 'panel-marketplace' in line and 'section-panel' in line:
        marketplace_start = i
        # The previous section ends here
        if studio_start and not studio_end:
            studio_end = i - 2  # A couple lines before

# Find the ending of marketplace (before </main>)
for i, line in enumerate(lines):
    if '</main>' in line:
        marketplace_end = i - 1
        break

print(f"panel-studio: lines {studio_start+1 if studio_start else 'N/A'} to {studio_end+1 if studio_end else 'N/A'}")
print(f"panel-marketplace: lines {marketplace_start+1 if marketplace_start else 'N/A'} to {marketplace_end+1 if marketplace_end else 'N/A'}")

# Function to add 12 spaces to lines that start with 4-8 spaces
def fix_indentation(line):
    # Count leading spaces
    stripped = line.lstrip()
    if not stripped:  # Empty line
        return line
    
    leading = len(line) - len(stripped)
    
    # If line has 4-8 spaces, it's likely misindented panel content
    # Add 12 more spaces to bring it to proper main interior level
    if 4 <= leading <= 8:
        return ' ' * 12 + line
    elif leading < 4 and stripped.startswith('<'):
        # HTML tags with very little indent - also fix
        return ' ' * 12 + line
    
    return line

# Apply fixes to studio section lines
if studio_start and studio_end:
    for i in range(studio_start, studio_end + 1):
        lines[i] = fix_indentation(lines[i])
    print(f"Fixed {studio_end - studio_start + 1} lines in panel-studio")

# Apply fixes to marketplace section lines  
if marketplace_start and marketplace_end:
    for i in range(marketplace_start, marketplace_end + 1):
        lines[i] = fix_indentation(lines[i])
    print(f"Fixed {marketplace_end - marketplace_start + 1} lines in panel-marketplace")

# Write back
with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("\nDashboard structure fixes complete!")
