# Find exact text around symbiosis-section
with open('apps.html', 'r', encoding='latin-1') as f:
    content = f.read()

idx = content.find('symbiosis-section')
if idx > 0:
    print("Found at index:", idx)
    print("Context (200 chars before and after):")
    print("---")
    print(content[idx-50:idx+200])
    print("---")
else:
    print("Not found")
