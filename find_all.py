# Find all occurrences of symbiosis-section
with open('apps.html', 'r', encoding='latin-1') as f:
    content = f.read()

# Find all occurrences
import re
matches = list(re.finditer(r'symbiosis-section', content))
print(f"Found {len(matches)} occurrences:")

for i, m in enumerate(matches):
    idx = m.start()
    context = content[idx-30:idx+100]
    print(f"\n{i+1}. Index {idx}:")
    print(f"   {context[:130]}")
