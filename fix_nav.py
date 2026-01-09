import re
import os
import glob

# The pattern to find and what to add
old_pattern = '<a href="suitehub.html"> Hub</a>\n                    </div>'
new_content = '''<a href="suitehub.html">🏠 Hub</a>
                        <a href="dashboard.html">⚙️ Dashboard</a>
                    </div>'''

# Alternative patterns (different spacing)
patterns = [
    ('<a href="suitehub.html"> Hub</a>\n                    </div>', 
     '<a href="suitehub.html">🏠 Hub</a>\n                        <a href="dashboard.html">⚙️ Dashboard</a>\n                    </div>'),
    ('<a href="suitehub.html"> Hub</a>\r\n                    </div>', 
     '<a href="suitehub.html">🏠 Hub</a>\r\n                        <a href="dashboard.html">⚙️ Dashboard</a>\r\n                    </div>'),
    ('<a href="suitehub.html">🏠 Hub</a>\n                    </div>', 
     '<a href="suitehub.html">🏠 Hub</a>\n                        <a href="dashboard.html">⚙️ Dashboard</a>\n                    </div>'),
    ('<a href="suitehub.html">🏠 Hub</a>\r\n                    </div>', 
     '<a href="suitehub.html">🏠 Hub</a>\r\n                        <a href="dashboard.html">⚙️ Dashboard</a>\r\n                    </div>'),
]

# Also fix missing emojis in nav items
emoji_fixes = [
    ('<a href="wallet.html"> Vault</a>', '<a href="wallet.html">🏦 Vault</a>'),
    ('<a href="earn.html"> Earn</a>', '<a href="earn.html">💰 Earn</a>'),
    ('<a href="boost.html"> Store</a>', '<a href="boost.html">🛒 Store</a>'),
    ('<a href="giving.html"> Giving</a>', '<a href="giving.html">💝 Giving</a>'),
    ('<a href="content.html"> Content</a>', '<a href="content.html">📚 Content</a>'),
    ('<a href="cadence.html"> Cadence</a>', '<a href="cadence.html">🎯 Cadence</a>'),
    ('<a href="suitehub.html"> Hub</a>', '<a href="suitehub.html">🏠 Hub</a>'),
    ('class="nav-cta">? Start Building</a>', 'class="nav-cta">🚀 Start Building</a>'),
]

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        original = content
        
        # First fix missing emojis
        for old, new in emoji_fixes:
            content = content.replace(old, new)
        
        # Then add dashboard if not already present
        if 'dashboard.html">⚙️ Dashboard</a>' not in content:
            for old, new in patterns:
                if old in content:
                    content = content.replace(old, new)
                    break
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"Error with {filepath}: {e}")
        return False

# Find all HTML files
html_files = glob.glob('*.html') + glob.glob('docs/*.html')
fixed = 0

for f in html_files:
    if fix_file(f):
        fixed += 1

print(f"\n✅ Fixed {fixed} files")
