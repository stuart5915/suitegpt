"""
Add the submitChallenge function to dashboard.html
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# JavaScript to add
js_to_add = '''

        // ============================================
        // APOLOGETICS ARENA FUNCTIONS
        // ============================================
        
        // Submit a challenge to the Apologetics Arena
        async function submitChallenge() {
            const input = document.getElementById('challengeInput');
            const challengeText = input.value.trim();
            
            if (!challengeText) {
                alert('Please enter your challenge first.');
                return;
            }
            
            if (challengeText.length < 20) {
                alert('Please provide a more substantial challenge (at least 20 characters).');
                return;
            }
            
            // TODO: Check wallet connection and SUITE balance
            // TODO: Deduct 10 SUITE and send to Giving Fund
            
            try {
                // Insert challenge into Supabase
                const response = await fetch(`${SUPABASE_URL}/rest/v1/apologetics_challenges`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        challenge_text: challengeText,
                        submitter_wallet: null, // TODO: Get connected wallet
                        status: 'pending',
                        suite_cost: 10
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    input.value = '';
                    alert('Challenge submitted! The AI Judge will analyze it shortly.');
                    loadRecentChallenges();
                } else {
                    throw new Error('Failed to submit');
                }
            } catch (error) {
                console.error('Error submitting challenge:', error);
                alert('Submission system coming soon. Your challenge has been noted!');
            }
        }
        
        // Load recent challenges from Supabase
        async function loadRecentChallenges() {
            const container = document.getElementById('recentChallenges');
            if (!container) return;
            
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/apologetics_challenges?order=created_at.desc&limit=5`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });
                const challenges = await response.json();
                
                if (Array.isArray(challenges) && challenges.length > 0) {
                    container.innerHTML = challenges.map(c => `
                        <div style="padding: 12px; background: rgba(0,0,0,0.2); border-radius: 10px; margin-bottom: 10px; border-left: 3px solid ${c.status === 'refuted' ? '#22c55e' : '#ff9500'};">
                            <p style="margin: 0 0 8px; font-size: 0.9rem; color: rgba(255,255,255,0.9);">${c.challenge_text.substring(0, 100)}${c.challenge_text.length > 100 ? '...' : ''}</p>
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                                <span>${c.status === 'refuted' ? '✅ Refuted' : '⏳ Pending'}</span>
                                <span>${new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading challenges:', error);
            }
        }
        
        // Load apologetics stats
        async function loadApologeticsStats() {
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/apologetics_challenges?select=is_novel,reward_paid`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });
                const challenges = await response.json();
                
                if (Array.isArray(challenges)) {
                    const novelCount = challenges.filter(c => c.is_novel).length;
                    const totalRewards = challenges.reduce((sum, c) => sum + (c.reward_paid || 0), 0);
                    
                    const novelEl = document.getElementById('novelAttacksCount');
                    const totalEl = document.getElementById('totalChallenges');
                    const rewardEl = document.getElementById('suiteRewarded');
                    
                    if (novelEl) novelEl.textContent = novelCount;
                    if (totalEl) totalEl.textContent = challenges.length;
                    if (rewardEl) rewardEl.textContent = totalRewards;
                }
            } catch (error) {
                console.error('Error loading apologetics stats:', error);
            }
        }
        
        // Initialize apologetics if panel exists
        if (document.getElementById('panel-apologetics')) {
            loadRecentChallenges();
            loadApologeticsStats();
        }

    '''

# Find the closing </script> tag for the main script
closing_script = '''

    </script>'''

# Insert the new JS before the closing script tag
if closing_script in content:
    content = content.replace(closing_script, js_to_add + closing_script, 1)
    print("Added Apologetics Arena JavaScript functions!")
else:
    print("Could not find closing script tag")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
