"""
Add JavaScript for admin detection on Constitution page
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# JavaScript to add
admin_js = '''

        // ============================================
        // CONSTITUTION ADMIN FUNCTIONS
        // ============================================
        
        // Check if user is admin for constitution submissions
        function checkConstitutionAdmin() {
            const costDisplay = document.getElementById('submissionCostDisplay');
            if (!costDisplay) return;
            
            // Check if owner (same logic as rest of dashboard)
            if (typeof isOwner !== 'undefined' && isOwner) {
                costDisplay.innerHTML = '<span style="color: #22c55e; font-weight: 700;">FREE</span> <span style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">(Admin)</span>';
            }
        }
        
        // Load TELOS history from Supabase
        async function loadTelosHistory() {
            const container = document.getElementById('telosHistory');
            if (!container) return;
            
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/telos_history?order=created_at.desc&limit=20`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });
                const history = await response.json();
                
                if (Array.isArray(history) && history.length > 0) {
                    // Prepend fetched history to existing genesis entry
                    const genesisHtml = container.innerHTML;
                    container.innerHTML = history.map(entry => `
                        <div style="display: flex; gap: 16px; padding: 16px; background: rgba(0,0,0,0.2); border-radius: 12px; margin-bottom: 12px; border-left: 3px solid ${entry.type === 'refinement' ? '#a855f7' : entry.type === 'addition' ? '#22c55e' : '#ff9500'};">
                            <div style="flex-shrink: 0; width: 80px; text-align: center;">
                                <div style="font-size: 1.2rem; font-weight: 900; color: ${entry.type === 'refinement' ? '#a855f7' : '#22c55e'};">v${entry.version}</div>
                                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">${entry.type.toUpperCase()}</div>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; color: white; margin-bottom: 4px;">${entry.title}</div>
                                <div style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-bottom: 8px;">${entry.description}</div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                                    <span>👤 ${entry.author || 'Anonymous'}</span>
                                    <span>📅 ${new Date(entry.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    `).join('') + genesisHtml;
                }
            } catch (error) {
                console.error('Error loading TELOS history:', error);
            }
        }
        
        // Initialize constitution panel when ready
        if (document.getElementById('panel-constitution')) {
            checkConstitutionAdmin();
            loadTelosHistory();
        }
        
        // Also check when section changes
        document.addEventListener('hashchange', () => {
            if (window.location.hash === '#constitution') {
                setTimeout(checkConstitutionAdmin, 100);
            }
        });

    '''

# Find the closing </script> tag
closing_script = '''

    </script>'''

if closing_script in content:
    content = content.replace(closing_script, admin_js + closing_script, 1)
    print("Added Constitution admin functions!")
else:
    print("Could not find closing script tag")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
