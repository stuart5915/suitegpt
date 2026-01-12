"""
Add History section to The Constitution panel and admin bypass
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find where to add the history section (before the Beyond Good and Evil section)
beyond_marker = '''<!-- Beyond Good and Evil -->'''
beyond_idx = content.find(beyond_marker)

if beyond_idx == -1:
    # Try alternate marker
    beyond_marker = '''<details style="margin-top: 24px; background: rgba(168, 85, 247, 0.1)'''
    beyond_idx = content.find(beyond_marker)

history_section = '''<!-- TELOS.md History & Changelog -->
                    <div style="margin-top: 24px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 149, 0, 0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="margin: 0; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                                <img src="assets/emojis/clay-book.png" alt="" style="width: 24px; height: 24px;">
                                TELOS.md History
                            </h3>
                            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">Immutable audit trail</span>
                        </div>
                        
                        <div style="margin-bottom: 16px; padding: 12px 16px; background: rgba(168, 85, 247, 0.1); border-radius: 10px; border-left: 3px solid #a855f7;">
                            <p style="margin: 0; font-size: 0.9rem; color: rgba(255,255,255,0.8);">
                                Every submission, refinement, and version change is permanently recorded here. 
                                This log will exist as long as the SUITE ecosystem exists — 
                                <strong style="color: #a855f7;">a living record from Day 1</strong>.
                            </p>
                        </div>
                        
                        <!-- Version History -->
                        <div id="telosHistory" style="max-height: 300px; overflow-y: auto;">
                            <!-- Initial Version -->
                            <div style="display: flex; gap: 16px; padding: 16px; background: rgba(0,0,0,0.2); border-radius: 12px; margin-bottom: 12px; border-left: 3px solid #22c55e;">
                                <div style="flex-shrink: 0; width: 80px; text-align: center;">
                                    <div style="font-size: 1.5rem; font-weight: 900; color: #22c55e;">v1.0</div>
                                    <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">GENESIS</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; color: white; margin-bottom: 4px;">Initial Constitution Created</div>
                                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-bottom: 8px;">
                                        5 core principles established: Truth Over Untruth, Human Flourishing, 
                                        Transparency, Sustainability, Alignment with Creator's Intent
                                    </div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                                        <span>👤 Stuart Hollinger (Founder)</span>
                                        <span>📅 Jan 11, 2026</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Placeholder for future entries -->
                            <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.4); font-style: italic;">
                                Future refinements will appear here...
                            </div>
                        </div>
                    </div>

                    '''

if beyond_idx != -1:
    content = content[:beyond_idx] + history_section + content[beyond_idx:]
    print("Added History section!")
else:
    print("Could not find insertion point for history section")

# Also update the cost display to show admin bypass
old_cost_display = '''<span style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Submission Cost:</span>
                                <span style="font-weight: 700; color: #ff9500;">0.5 SUITE <span style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">(~$0.002)</span></span>'''

new_cost_display = '''<span style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Submission Cost:</span>
                                <span id="submissionCostDisplay" style="font-weight: 700; color: #ff9500;">0.5 SUITE <span style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">(~$0.002)</span></span>'''

content = content.replace(old_cost_display, new_cost_display)

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
