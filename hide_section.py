# Hide symbiosis-section using CSS display:none
with open('apps.html', 'r', encoding='latin-1') as f:
    content = f.read()

# Find the symbiosis-section CSS rule and add display:none
target = '.symbiosis-section {'
if target in content:
    replacement = '.symbiosis-section { display: none; /* COMING SOON - HIDDEN */'
    content = content.replace(target, replacement, 1)
    
    with open('apps.html', 'w', encoding='latin-1') as f:
        f.write(content)
    
    print("Hidden symbiosis-section with CSS display:none")
    print("Done! Refresh browser.")
else:
    print("Could not find .symbiosis-section CSS rule")
