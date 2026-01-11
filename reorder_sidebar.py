import re

# Read the file
with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the AI Factory section
ai_factory_start = content.find('<!-- AI Factory (Public - visible to all) -->')
if ai_factory_start == -1:
    print("AI Factory section not found!")
    exit()

# Find the end of the AI Factory section (next <!-- or sidebar-section)
ai_factory_end = content.find('</div>\n\n                <!--', ai_factory_start)
if ai_factory_end == -1:
    ai_factory_end = content.find('</div>\n                </div>', ai_factory_start)
    
# Get exact bounds - find the closing </div> for the section
temp = content[ai_factory_start:]
# Count divs to find the matching close
depth = 0
end_offset = 0
for i, char in enumerate(temp):
    if temp[i:i+4] == '<div':
        depth += 1
    elif temp[i:i+6] == '</div>':
        depth -= 1
        if depth == 0:
            end_offset = i + 6
            break

ai_factory_section = content[ai_factory_start:ai_factory_start + end_offset]
print(f"Found AI Factory section:\n{ai_factory_section[:200]}...")

# Find where Earn & Spend starts
earn_spend_start = content.find('<!-- Earn & Spend -->')
if earn_spend_start == -1:
    print("Earn & Spend section not found!")
    exit()

print(f"\nEarn & Spend starts at position: {earn_spend_start}")
print(f"AI Factory starts at position: {ai_factory_start}")

# Remove AI Factory from its current location
content_without_ai = content[:ai_factory_start] + content[ai_factory_start + end_offset:]

# Find Earn & Spend again in the modified content
earn_spend_start_new = content_without_ai.find('<!-- Earn & Spend -->')

# Insert AI Factory before Earn & Spend with proper spacing
new_content = (
    content_without_ai[:earn_spend_start_new] + 
    ai_factory_section + '\n\n                ' +
    content_without_ai[earn_spend_start_new:]
)

# Write back
with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('\nMoved AI Factory to first position in sidebar!')
