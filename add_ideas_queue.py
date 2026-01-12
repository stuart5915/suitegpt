"""
Add TELOS Ideas Approval Queue to AI Fleet panel
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the stats grid end and insert after it
stats_end = '<!-- Two Column Layout -->'
stats_idx = content.find(stats_end)

if stats_idx == -1:
    print("Could not find Two Column Layout marker")
    exit(1)

# New Ideas Queue section
ideas_queue = '''<!-- TELOS Ideas Approval Queue -->
                        <div style="margin-bottom: 24px; background: linear-gradient(135deg, rgba(255, 149, 0, 0.1), rgba(255, 107, 157, 0.05)); border-radius: 16px; padding: 20px; border: 2px solid rgba(255, 149, 0, 0.2);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <h4 style="margin: 0; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                                    <img src="assets/emojis/clay-sparkles.png" alt="" style="width: 24px; height: 24px;">
                                    Ideas Awaiting Approval
                                </h4>
                                <button onclick="generateNewIdea()" style="padding: 8px 16px; background: linear-gradient(135deg, #ff9500, #ff6b9d); color: white; border: none; border-radius: 100px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                                    + Generate Idea
                                </button>
                            </div>
                            
                            <div id="telosIdeasQueue" style="max-height: 300px; overflow-y: auto;">
                                <!-- Ideas load here dynamically -->
                                <div style="text-align: center; padding: 30px; color: #888;">
                                    <img src="assets/emojis/clay-rocket.png" alt="" style="width: 40px; height: 40px; opacity: 0.5; margin-bottom: 10px;">
                                    <p style="margin: 0;">No pending ideas. Enable TELOS mode or click "Generate Idea"</p>
                                </div>
                            </div>
                        </div>

                        <!-- Apps Under Review (Build Complete) -->
                        <div style="margin-bottom: 24px; background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.05)); border-radius: 16px; padding: 20px; border: 2px solid rgba(168, 85, 247, 0.2);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <h4 style="margin: 0; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                                    <img src="assets/emojis/clay-trophy.png" alt="" style="width: 24px; height: 24px;">
                                    Ready for Review
                                </h4>
                                <span id="reviewCount" style="padding: 4px 12px; background: rgba(168, 85, 247, 0.2); color: #a855f7; border-radius: 100px; font-size: 0.8rem; font-weight: 700;">0</span>
                            </div>
                            
                            <div id="telosReviewQueue" style="max-height: 200px; overflow-y: auto;">
                                <div style="text-align: center; padding: 20px; color: #888;">
                                    <p style="margin: 0;">No apps ready for review yet</p>
                                </div>
                            </div>
                        </div>

                        '''

# Insert before Two Column Layout
content = content[:stats_idx] + ideas_queue + content[stats_idx:]

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added Ideas Approval Queue and Review Queue to AI Fleet panel!")
