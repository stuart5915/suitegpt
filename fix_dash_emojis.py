#!/usr/bin/env python3
"""Fix broken emoji characters (??) in dashboard.html"""

import re

# Read the file
with open('dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Define replacements - map broken ?? patterns to proper emojis
replacements = {
    # Campaign section
    '?? Create Campaign': '📢 Create Campaign',
    '?? Launch Campaign': '🚀 Launch Campaign',
    '?? Your Campaigns': '📊 Your Campaigns',
    
    # Reviews section
    '?? Reviews': '⭐ Reviews',
    '?? Request Reviews': '⭐ Request Reviews',
    '?? Your Reviews': '📝 Your Reviews',
    
    # Power-Ups section
    '?? Power-Ups': '⚡ Power-Ups',
    '?? Create Power-Up': '⚡ Create Power-Up',
    '?? Your Power-Ups': '🎮 Your Power-Ups',
    
    # Content section
    '?? Content': '📝 Content',
    '?? Content Studio': '🎬 Content Studio',
    '?? Content Marketplace': '🛒 Content Marketplace',
    '?? Marketplace': '🏪 Marketplace',
    
    # Cadence section
    '?? Cadence': '🎵 Cadence',
    '?? Cadence AI': '🎵 Cadence AI',
    
    # Community section
    '?? Community': '👥 Community',
    '?? SUITEHub': '🏠 SUITEHub',
    '?? SUITE Hub': '🏠 SUITE Hub',
    
    # Giving section
    '?? Giving': '❤️ Giving',
    
    # Navigation emojis
    '?? Vault': '🏦 Vault',
    '?? Dashboard': '💼 Dashboard',
    '?? Learn': '📚 Learn',
    '?? Start Building': '🚀 Start Building',
    
    # Other common broken emojis
    '?? Apps': '📱 Apps',
    '?? Build': '🔨 Build',
    '?? Discuss': '💬 Discuss',
    '?? Incubate': '🌱 Incubate',
    '?? Docs': '📖 Docs',
    
    # Section toggles (single ?)
    # These are likely arrow characters
}

# Apply replacements
for old, new in replacements.items():
    content = content.replace(old, new)

# Also fix standalone section toggle arrows (? -> ▼ or ▶)
# This is commonly used for expand/collapse
content = re.sub(r'class="section-toggle">(\?)</div>', r'class="section-toggle">▼</div>', content)

# Write the fixed content
with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed emoji characters in dashboard.html")

# Count remaining ?? patterns
remaining = content.count('??')
print(f"Remaining ?? patterns: {remaining}")
if remaining > 0:
    # Find and print lines with remaining ??
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if '??' in line:
            print(f"Line {i+1}: {line[:100]}...")
