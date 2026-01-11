"""
Add the showFleetDivision function to dashboard.html
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# JavaScript to add before the closing </script> tag
js_to_add = '''

        // Fleet Division Tab Switching
        function showFleetDivision(divisionId) {
            // Hide all divisions
            document.querySelectorAll('.fleet-division').forEach(div => {
                div.style.display = 'none';
                div.classList.remove('active');
            });
            
            // Show target division
            const target = document.getElementById('fleet-division-' + divisionId);
            if (target) {
                target.style.display = 'block';
                target.classList.add('active');
            }
            
            // Update tab styles
            document.querySelectorAll('.fleet-tab').forEach(tab => {
                if (tab.getAttribute('data-division') === divisionId) {
                    tab.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                    tab.style.borderColor = '#6366f1';
                    tab.style.color = 'white';
                    tab.classList.add('active');
                } else {
                    tab.style.background = 'white';
                    tab.style.borderColor = '#ddd';
                    tab.style.color = '#666';
                    tab.classList.remove('active');
                }
            });
        }

        // Toggle focus pill selection
        function toggleFocusPill(el) {
            el.classList.toggle('active');
            if (el.classList.contains('active')) {
                el.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                el.style.color = 'white';
            } else {
                el.style.background = 'rgba(99, 102, 241, 0.1)';
                el.style.color = '#6366f1';
            }
        }

        // Toggle TELOS mode
        function toggleTelosMode() {
            const toggle = document.getElementById('telosMainToggle');
            const isEnabled = toggle.checked;
            updateTelosUI(isEnabled);
        }

        // Update TELOS UI based on state
        function updateTelosUI(isEnabled) {
            const slider = document.getElementById('telosSlider');
            const knob = document.getElementById('telosKnob');
            const onLabel = document.getElementById('telosOnLabel');
            const offLabel = document.getElementById('telosOffLabel');
            const explanation = document.getElementById('telosExplanation');
            const statusText = document.getElementById('telosStatusText');

            if (isEnabled) {
                slider.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
                slider.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                knob.style.left = '44px';
                onLabel.style.color = '#22c55e';
                onLabel.style.fontWeight = '700';
                offLabel.style.color = '#888';
                offLabel.style.fontWeight = '600';
                explanation.style.background = 'rgba(34, 197, 94, 0.1)';
                explanation.style.borderLeftColor = '#22c55e';
                explanation.innerHTML = '<p style="margin: 0; font-size: 0.9rem; color: #16a34a; font-weight: 600;">ACTIVE: AI is researching markets, building apps, and deploying automatically.</p>';
                statusText.textContent = 'AI creates apps autonomously 24/7';
            } else {
                slider.style.background = '#ccc';
                slider.style.boxShadow = 'none';
                knob.style.left = '4px';
                onLabel.style.color = '#888';
                onLabel.style.fontWeight = '600';
                offLabel.style.color = '#6b7280';
                offLabel.style.fontWeight = '700';
                explanation.style.background = 'rgba(107, 114, 128, 0.1)';
                explanation.style.borderLeftColor = '#6b7280';
                explanation.innerHTML = '<p style="margin: 0; font-size: 0.9rem; color: #6b7280; font-weight: 600;">PAUSED: AI only responds to human requests (bugs, features)</p>';
                statusText.textContent = 'AI responds to human requests only';
            }
        }

        // Placeholder for saving TELOS config
        function saveTelosConfig() {
            alert('Configuration saved! (Supabase integration coming soon)');
        }

    '''

# Find the closing </script> tag for the main script
closing_script = '''

    </script>'''

# Insert the new JS before the closing script tag
content = content.replace(closing_script, js_to_add + closing_script)

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added showFleetDivision and toggle functions!")
