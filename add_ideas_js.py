"""
Add TELOS Ideas Queue JavaScript functions
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# JavaScript to add
ideas_js = '''

        // ============================================
        // TELOS IDEAS QUEUE FUNCTIONS
        // ============================================
        
        // Load pending ideas from Supabase
        async function loadTelosIdeas() {
            const container = document.getElementById('telosIdeasQueue');
            if (!container) return;
            
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?status=eq.pending&order=created_at.desc`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });
                const ideas = await response.json();
                
                if (Array.isArray(ideas) && ideas.length > 0) {
                    container.innerHTML = ideas.map(idea => {
                        const features = typeof idea.features === 'string' ? JSON.parse(idea.features) : (idea.features || []);
                        return `
                        <div class="telos-idea-card" style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #ff9500;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div>
                                    <h5 style="margin: 0 0 4px; font-size: 1.1rem; font-weight: 800; color: #2d1b4e;">${idea.name}</h5>
                                    <span style="font-size: 0.8rem; color: #888; background: rgba(255, 149, 0, 0.1); padding: 2px 8px; border-radius: 100px;">${idea.focus_area || 'General'}</span>
                                </div>
                                <span style="font-size: 0.75rem; color: #888;">${new Date(idea.created_at).toLocaleString()}</span>
                            </div>
                            <p style="margin: 0 0 10px; color: #5a4a6f; font-size: 0.9rem;">${idea.tagline || idea.description?.substring(0, 100) || 'No description'}</p>
                            ${features.length > 0 ? `
                            <div style="margin-bottom: 12px;">
                                ${features.slice(0, 3).map(f => `<span style="display: inline-block; background: rgba(99, 102, 241, 0.1); color: #6366f1; padding: 4px 10px; border-radius: 100px; font-size: 0.75rem; margin-right: 6px; margin-bottom: 4px;">${f}</span>`).join('')}
                            </div>
                            ` : ''}
                            <div style="display: flex; gap: 10px;">
                                <button onclick="approveIdea('${idea.id}')" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
                                    ✅ Approve & Build
                                </button>
                                <button onclick="rejectIdea('${idea.id}')" style="padding: 10px 16px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 8px; font-weight: 600; cursor: pointer;">
                                    ❌ Reject
                                </button>
                                <button onclick="regenerateIdea('${idea.id}')" style="padding: 10px 16px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 2px solid rgba(99, 102, 241, 0.3); border-radius: 8px; font-weight: 600; cursor: pointer;">
                                    🔄 New Idea
                                </button>
                            </div>
                        </div>
                    `}).join('');
                } else {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 30px; color: #888;">
                            <img src="assets/emojis/clay-rocket.png" alt="" style="width: 40px; height: 40px; opacity: 0.5; margin-bottom: 10px;">
                            <p style="margin: 0;">No pending ideas. Enable TELOS mode or click "Generate Idea"</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading ideas:', error);
            }
        }
        
        // Load apps ready for review
        async function loadTelosReview() {
            const container = document.getElementById('telosReviewQueue');
            const countEl = document.getElementById('reviewCount');
            if (!container) return;
            
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?status=eq.review&order=build_completed_at.desc`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });
                const apps = await response.json();
                
                if (countEl) countEl.textContent = apps.length || 0;
                
                if (Array.isArray(apps) && apps.length > 0) {
                    container.innerHTML = apps.map(app => `
                        <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 10px; border-left: 4px solid #a855f7;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <h5 style="margin: 0; font-weight: 700;">${app.name}</h5>
                                <span style="font-size: 0.75rem; color: #888;">${app.build_iterations || 0} iterations</span>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="deployApp('${app.id}')" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #a855f7, #6366f1); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">
                                    🏪 Deploy
                                </button>
                                <button onclick="refineApp('${app.id}')" style="padding: 8px 12px; background: rgba(255, 149, 0, 0.1); color: #f59e0b; border: none; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">
                                    ✏️ Refine
                                </button>
                                <button onclick="scrapApp('${app.id}')" style="padding: 8px 12px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;"><p style="margin: 0;">No apps ready for review yet</p></div>';
                }
            } catch (error) {
                console.error('Error loading review queue:', error);
            }
        }
        
        // Approve an idea and start building
        async function approveIdea(ideaId) {
            if (!confirm('Approve this idea and start building?')) return;
            
            try {
                // Get the idea with its generated prompt
                const getResponse = await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?id=eq.${ideaId}`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });
                const ideas = await getResponse.json();
                if (!ideas.length) return;
                
                const idea = ideas[0];
                
                // Update idea status to 'building'
                await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?id=eq.${ideaId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'building',
                        approved_at: new Date().toISOString(),
                        build_started_at: new Date().toISOString()
                    })
                });
                
                // Insert the build prompt into prompts table
                const promptResponse = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        prompt: idea.generated_prompt,
                        status: 'pending',
                        prompt_type: 'telos_build',
                        source: `TELOS: ${idea.name}`,
                        metadata: JSON.stringify({ idea_id: ideaId, app_name: idea.name })
                    })
                });
                
                if (promptResponse.ok) {
                    alert(`✅ ${idea.name} approved! Building will start shortly.`);
                    loadTelosIdeas();
                }
            } catch (error) {
                console.error('Error approving idea:', error);
                alert('Failed to approve idea');
            }
        }
        
        // Reject an idea
        async function rejectIdea(ideaId) {
            const reason = prompt('Rejection reason (optional):');
            
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?id=eq.${ideaId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'rejected',
                        rejection_reason: reason || 'No reason provided'
                    })
                });
                
                loadTelosIdeas();
            } catch (error) {
                console.error('Error rejecting idea:', error);
            }
        }
        
        // Generate a new idea to replace the current one
        async function regenerateIdea(ideaId) {
            // First reject the current idea
            await rejectIdea(ideaId);
            // Then generate a new one
            generateNewIdea();
        }
        
        // Manually trigger idea generation
        async function generateNewIdea() {
            alert('Sending idea generation request to Antigravity...');
            
            // Insert an idea generation prompt
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: `[TELOS MODE - IDEA GENERATION]

You are generating an app idea for the SUITE ecosystem.

Generate a UNIQUE mobile app concept and respond with ONLY a JSON object:
{
    "name": "AppName",
    "tagline": "One line description under 60 chars",
    "description": "2-3 sentences about what it does",
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "target_audience": "Who it's for",
    "monetization": "How it makes money"
}

Requirements:
- Simple enough to build in 50 iterations
- Useful for everyday people
- Aligned with Christian values
- React Native / Expo compatible

RESPOND WITH ONLY THE JSON. NO MARKDOWN.`,
                        status: 'pending',
                        prompt_type: 'telos_idea',
                        source: 'TELOS Mode (Manual)'
                    })
                });
                
                if (response.ok) {
                    alert('✅ Idea request sent! Watch Activity Feed for the response.');
                }
            } catch (error) {
                console.error('Error generating idea:', error);
            }
        }
        
        // Deploy an app to stores
        async function deployApp(ideaId) {
            if (!confirm('Deploy this app to Expo/App Stores?')) return;
            
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?id=eq.${ideaId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'deployed',
                        deployed_at: new Date().toISOString()
                    })
                });
                
                alert('🚀 Deploy triggered! Check EAS Build for progress.');
                loadTelosReview();
            } catch (error) {
                console.error('Error deploying:', error);
            }
        }
        
        // Add refinement notes and continue building
        async function refineApp(ideaId) {
            const notes = prompt('What refinements are needed?');
            if (!notes) return;
            
            try {
                // Get the idea
                const getResponse = await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?id=eq.${ideaId}`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });
                const ideas = await getResponse.json();
                if (!ideas.length) return;
                
                const idea = ideas[0];
                
                // Update status back to building
                await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?id=eq.${ideaId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'building',
                        refinement_notes: notes
                    })
                });
                
                // Insert refinement prompt
                await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: `[REFINEMENT for ${idea.name}]\\n\\n${notes}`,
                        status: 'pending',
                        prompt_type: 'telos_refine',
                        source: `TELOS Refinement: ${idea.name}`,
                        metadata: JSON.stringify({ idea_id: ideaId })
                    })
                });
                
                alert('✏️ Refinement request sent!');
                loadTelosReview();
            } catch (error) {
                console.error('Error refining:', error);
            }
        }
        
        // Scrap/delete an app
        async function scrapApp(ideaId) {
            if (!confirm('Are you sure you want to scrap this app?')) return;
            
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/telos_ideas?id=eq.${ideaId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'scrapped' })
                });
                
                loadTelosReview();
            } catch (error) {
                console.error('Error scrapping:', error);
            }
        }
        
        // Initialize TELOS queues when AI Fleet panel is visible
        if (document.getElementById('telosIdeasQueue')) {
            loadTelosIdeas();
            loadTelosReview();
            // Refresh every 30 seconds
            setInterval(() => {
                loadTelosIdeas();
                loadTelosReview();
            }, 30000);
        }

    '''

# Find the closing </script> tag
closing_script = '''

    </script>'''

if closing_script in content:
    content = content.replace(closing_script, ideas_js + closing_script, 1)
    print("Added TELOS Ideas Queue JavaScript functions!")
else:
    print("Could not find closing script tag")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
