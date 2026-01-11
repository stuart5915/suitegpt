"""
Add tooltip and pulse animation CSS
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# CSS to add in the <style> section
css_to_add = '''
        /* Fleet Division Tabs */
        .fleet-tab:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        /* Tooltip for TELOS */
        .telos-tooltip-wrapper:hover .telos-tooltip {
            opacity: 1 !important;
            visibility: visible !important;
        }
        
        span:hover > .telos-tooltip {
            opacity: 1 !important;
            visibility: visible !important;
        }

        /* Pulse animation */
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Active division styling */
        .fleet-division.active {
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

'''

# Find the </style> tag to insert before it
style_close = '</style>'
style_close_idx = content.find(style_close)

if style_close_idx != -1:
    content = content[:style_close_idx] + css_to_add + content[style_close_idx:]
    print("Added CSS for fleet tabs, tooltips, and animations!")
else:
    print("Could not find </style> tag")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
