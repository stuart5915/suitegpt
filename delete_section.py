# Delete symbiosis-section from apps.html
with open('apps.html', 'r', encoding='latin-1') as f:
    content = f.read()

# Find and count symbiosis-section occurrences
print(f"File has {len(content)} chars")
print(f"'symbiosis-section' found: {'symbiosis-section' in content}")

# Find the start and end of the section
start_marker = '<div class="symbiosis-section'
end_marker = '</div>\n            </div>\n        </div>'  # End of section

start_idx = content.find(start_marker)
print(f"Start index: {start_idx}")

if start_idx > 0:
    # Find the closing of this div section (look for matching divs)
    section_content = content[start_idx:start_idx+5000]  # Get chunk to analyze
    print(f"Section starts with: {section_content[:200]}")
    
    # Find the next major section after symbiosis
    end_section = content.find('<!-- App Cards -->', start_idx)
    if end_section == -1:
        end_section = content.find('<!-- Featured Apps -->', start_idx)
    if end_section == -1:
        end_section = content.find('<section', start_idx + 100)
    
    print(f"End section at: {end_section}")
    
    if end_section > start_idx:
        # Remove the section
        new_content = content[:start_idx] + content[end_section:]
        
        with open('apps.html', 'w', encoding='latin-1') as f:
            f.write(new_content)
        
        print(f"Removed {end_section - start_idx} chars")
        print("Done! Refresh browser.")
    else:
        print("Could not find end of section")
else:
    print("Could not find symbiosis-section")
