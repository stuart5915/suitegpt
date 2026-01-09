import re
import os
import glob

# Read the canonical nav template
with open('nav-template.html', 'r', encoding='utf-8') as f:
    NAV_TEMPLATE = f.read().strip()

# For docs folder, we need relative paths
NAV_TEMPLATE_DOCS = NAV_TEMPLATE.replace(
    'href="index.html"', 'href="../index.html"'
).replace(
    'href="apps.html"', 'href="../apps.html"'
).replace(
    'href="developer-portal.html"', 'href="../developer-portal.html"'
).replace(
    'href="discuss.html"', 'href="../discuss.html"'
).replace(
    'href="incubate.html"', 'href="../incubate.html"'
).replace(
    'href="docs/index.html"', 'href="index.html"'
).replace(
    'href="wallet.html"', 'href="../wallet.html"'
).replace(
    'href="earn.html"', 'href="../earn.html"'
).replace(
    'href="boost.html"', 'href="../boost.html"'
).replace(
    'href="giving.html"', 'href="../giving.html"'
).replace(
    'href="content.html"', 'href="../content.html"'
).replace(
    'href="cadence.html"', 'href="../cadence.html"'
).replace(
    'href="suitehub.html"', 'href="../suitehub.html"'
).replace(
    'href="dashboard.html"', 'href="../dashboard.html"'
).replace(
    'href="start-building.html"', 'href="../start-building.html"'
).replace(
    'src="assets/suite-mascot.png"', 'src="../assets/suite-mascot.png"'
)

def replace_nav(filepath):
    """Replace the nav section in a file with the canonical template."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        original = content
        
        # Determine which template to use
        is_docs = 'docs/' in filepath or 'docs\\' in filepath
        template = NAV_TEMPLATE_DOCS if is_docs else NAV_TEMPLATE
        
        # Find the nav section using regex
        # Pattern matches: <!-- Navigation --> ... </nav> OR <nav class="nav"> ... </nav>
        nav_pattern = r'(<!--\s*Navigation\s*-->\s*)?<nav\s+class=["\']nav["\'][^>]*>.*?</nav>'
        
        match = re.search(nav_pattern, content, re.DOTALL | re.IGNORECASE)
        
        if match:
            # Replace the nav section
            content = content[:match.start()] + template + content[match.end():]
            
            if content != original:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ Fixed: {filepath}")
                return True
            else:
                print(f"⏭️  No change needed: {filepath}")
                return False
        else:
            print(f"⚠️  No nav found: {filepath}")
            return False
            
    except Exception as e:
        print(f"❌ Error with {filepath}: {e}")
        return False

# Get all HTML files
root_files = glob.glob('*.html')
docs_files = glob.glob('docs/*.html')

# Exclude template file
root_files = [f for f in root_files if 'nav-template' not in f]

print("=" * 50)
print("REBUILDING NAVIGATION ACROSS ALL PAGES")
print("=" * 50)
print()

print("📁 Root files:")
fixed_root = 0
for f in sorted(root_files):
    if replace_nav(f):
        fixed_root += 1

print()
print("📁 Docs files:")
fixed_docs = 0
for f in sorted(docs_files):
    if replace_nav(f):
        fixed_docs += 1

print()
print("=" * 50)
print(f"✅ Total fixed: {fixed_root + fixed_docs} files")
print(f"   - Root: {fixed_root}")
print(f"   - Docs: {fixed_docs}")
print("=" * 50)
