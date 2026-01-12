# Find line number of symbiosis-section
with open('apps.html', 'r', encoding='latin-1') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'symbiosis-section' in line:
        print(f"Line {i+1}: {line[:100]}")
