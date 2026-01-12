"""
Rename panel-apologetics to panel-constitution and embed TELOS.md
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Rename the panel ID
content = content.replace('id="panel-apologetics"', 'id="panel-constitution"')
content = content.replace("getElementById('panel-apologetics')", "getElementById('panel-constitution')")

# Update the header/title
content = content.replace('TELOS Refinement Arena', 'The Constitution')
content = content.replace('Stress-test and strengthen the master constitution that governs all SUITE AI systems.', 
                          'TELOS.md — The master constitution governing all AI systems in the SUITE ecosystem.')

print("Renamed panel to 'constitution' and updated title!")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
