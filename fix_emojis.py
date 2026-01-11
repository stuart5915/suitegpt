import re

# Read the file
with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Define emoji to clay image mappings for sidebar icons
sidebar_replacements = [
    ("Earn\n", "clay-coins.png"),
    ("Store\n", "clay-cart.png"),
    ("Overview\n", "clay-gear.png"),
    ("Your Apps\n", "clay-phone.png"),
    ("Campaigns\n", "clay-rocket.png"),
    ("Reviews\n", "clay-sparkles.png"),
    ("Power-Ups\n", "clay-trophy.png"),
    ("Content Studio\n", "clay-book.png"),
    ("Marketplace\n", "clay-cart.png"),
    ("Cadence\n", "clay-target.png"),
    ("SUITEHub\n", "clay-house.png"),
    ("Giving\n", "clay-heart-ribbon.png"),
    ("AI Fleet\n", "clay-rocket.png"),
    ("Treasury\n", "clay-vault.png"),
]

# Replace each sidebar icon based on context
for name, img in sidebar_replacements:
    # Match the ?? before each name
    old_pattern = f'<span class="sidebar-link-icon">??</span>\n                        {name}'
    new_html = f'<span class="sidebar-link-icon"><img src="assets/emojis/{img}" alt="" style="width:18px;height:18px;"></span>\n                        {name}'
    content = content.replace(old_pattern, new_html)
    
    # Also try with single ?
    old_pattern2 = f'<span class="sidebar-link-icon">?</span>\n                        {name}'
    content = content.replace(old_pattern2, new_html)

# Fix TELOS MODE header
content = content.replace('?? TELOS MODE', '🎯 TELOS MODE')

# Fix AI Fleet Dashboard header  
content = content.replace('?? AI Fleet Dashboard', '🤖 AI Fleet Dashboard')

# Fix Earn SUITE header
content = content.replace('?? Earn SUITE', '💰 Earn SUITE')

# Fix other common patterns
replacements = [
    ('??Open Full Earn Page', '➡️ Open Full Earn Page'),
    ('?? Open Full Earn Page', '➡️ Open Full Earn Page'),
    ('??Forge', '🔧 Forge'),
    ('?? Forge', '🔧 Forge'),
    ('?? Autonomous Behavior', '🧠 Autonomous Behavior'),
    ('?? Health', '💪 Health'),
    ('?? Productivity', '📊 Productivity'),
    ('?? Finance', '💰 Finance'),
    ('?? Creativity', '🎨 Creativity'),
    ('?? Social', '👥 Social'),
    ('?? Education', '📚 Education'),
    ('?? Entertainment', '🎮 Entertainment'),
    ('?? Consumers', '👤 Consumers'),
    ('?? Business', '🏢 Business'),
    ('?? Developers', '💻 Developers'),
    ('?? Standard', '⚙️ Standard'),
    ('? Scheduling', '⏰ Scheduling'),
    ('?? Workflow', '🔄 Workflow'),
    ('?? Constraints', '🚫 Constraints'),
    ('? ACTIVE', '✅ ACTIVE'),
    ('??? Forge', '🔧🖥️ Forge'),
    ('??Learn More', '📖 Learn More'),
    ('?? Learn More', '📖 Learn More'),
]

for old, new in replacements:
    content = content.replace(old, new)

# Write back
with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed dashboard emojis!')
