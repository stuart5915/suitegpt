# Debug script to check what's in apps.html
# Run with: python debug_apps.py

with open('apps.html', 'rb') as f:
    content = f.read()

# Check for various strings
checks = [
    b'symbiosis',
    b'Two Paths',
    b'AI Fleet',
    b'ecosystem',
    b'canvas-container'
]

print("=== DEBUG: Checking apps.html ===")
print(f"File size: {len(content)} bytes")
print()

for check in checks:
    if check in content:
        idx = content.find(check)
        snippet = content[max(0,idx-20):idx+50]
        print(f"FOUND: {check}")
        print(f"  Context: ...{snippet}...")
        print()
    else:
        print(f"NOT FOUND: {check}")
        print()
