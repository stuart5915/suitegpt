"""
Add Apologetics Arena panel to dashboard.html before the Giving panel
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# The new Apologetics Arena panel
apologetics_panel = '''<!-- Apologetics Arena Panel -->
                <div id="panel-apologetics" class="section-panel">
                    <div class="panel-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
                        <div>
                            <h2 class="panel-title" style="display: flex; align-items: center; gap: 12px;">
                                <img src="assets/emojis/clay-trophy.png" alt="" style="width: 32px; height: 32px;">
                                Apologetics Arena
                            </h2>
                            <p class="panel-desc">Challenge the faith. Seek truth. Watch arguments get refuted in real-time.</p>
                        </div>
                        <a href="https://docs.getsuite.app/school/apologetics" target="_blank" style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 10px 18px; border-radius: 100px; font-size: 0.85rem; font-weight: 700; text-decoration: none;">
                            <img src="assets/emojis/clay-book.png" alt="" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 6px;">Learn More
                        </a>
                    </div>

                    <!-- Stats Banner -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                        <div style="text-align: center; padding: 24px; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 16px; color: white;">
                            <div id="novelAttacksCount" style="font-size: 2.5rem; font-weight: 900;">0</div>
                            <div style="font-size: 0.9rem; opacity: 0.9;">Novel Attacks Refuted</div>
                        </div>
                        <div style="text-align: center; padding: 24px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(255, 149, 0, 0.2);">
                            <div id="totalChallenges" style="font-size: 2.5rem; font-weight: 900; color: #ff9500;">0</div>
                            <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Total Challenges</div>
                        </div>
                        <div style="text-align: center; padding: 24px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(168, 85, 247, 0.2);">
                            <div id="suiteRewarded" style="font-size: 2.5rem; font-weight: 900; color: #a855f7;">0</div>
                            <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">SUITE Rewarded</div>
                        </div>
                    </div>

                    <!-- Core Principle -->
                    <div style="background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
                        <div style="font-weight: 700; color: #22c55e; margin-bottom: 4px;">CORE PRINCIPLE</div>
                        <p style="margin: 0; color: rgba(255,255,255,0.9);">Truth wins over untruth. Always.</p>
                    </div>

                    <!-- Two Column Layout -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        
                        <!-- Submit Challenge Form -->
                        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 149, 0, 0.1);">
                            <h3 style="margin: 0 0 16px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                                <img src="assets/emojis/clay-chat.png" alt="" style="width: 24px; height: 24px;">
                                Submit a Challenge
                            </h3>
                            
                            <div style="margin-bottom: 16px;">
                                <label style="font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 8px;">Your Argument</label>
                                <textarea id="challengeInput" placeholder="Pose an argument or question challenging the Christian faith..." style="width: 100%; min-height: 120px; padding: 14px; border: 2px solid rgba(255, 149, 0, 0.2); border-radius: 12px; background: rgba(0,0,0,0.2); color: white; font-size: 0.95rem; resize: vertical;"></textarea>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px 16px; background: rgba(255, 149, 0, 0.1); border-radius: 10px;">
                                <span style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Submission Cost:</span>
                                <span style="font-weight: 700; color: #ff9500;">10 SUITE</span>
                            </div>
                            
                            <button onclick="submitChallenge()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ff9500, #ff6b9d); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <img src="assets/emojis/clay-rocket.png" alt="" style="width: 20px; height: 20px;">
                                Submit Challenge
                            </button>
                            
                            <p style="margin: 12px 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.5); text-align: center;">
                                Tokens go to the Giving Fund. Novel challenges earn SUITE rewards!
                            </p>
                        </div>
                        
                        <!-- Recent Challenges -->
                        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 149, 0, 0.1);">
                            <h3 style="margin: 0 0 16px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                                <img src="assets/emojis/clay-sparkles.png" alt="" style="width: 24px; height: 24px;">
                                Recent Challenges
                            </h3>
                            
                            <div id="recentChallenges" style="max-height: 300px; overflow-y: auto;">
                                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
                                    <img src="assets/emojis/clay-book.png" alt="" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 12px;">
                                    <p style="margin: 0;">No challenges yet. Be the first!</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Beyond Good and Evil Section -->
                    <details style="margin-top: 24px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 16px;">
                        <summary style="padding: 16px 20px; cursor: pointer; font-weight: 700; color: #a855f7; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.1rem;">Beyond Good and Evil</span>
                            <span style="font-size: 0.75rem; background: rgba(168, 85, 247, 0.2); padding: 4px 10px; border-radius: 100px;">Meta-Perspective</span>
                        </summary>
                        <div style="padding: 0 20px 20px;">
                            <p style="color: rgba(255,255,255,0.8); line-height: 1.7; margin-bottom: 16px;">
                                While "Truth wins over untruth" is the core principle, the SUITE School acknowledges deeper philosophical frameworks 
                                that transcend simple binary thinking. These include:
                            </p>
                            <ul style="color: rgba(255,255,255,0.7); line-height: 1.8; margin: 0; padding-left: 20px;">
                                <li><strong>Moment View</strong> — Understanding reality through present-moment consciousness</li>
                                <li><strong>Existential Matrix</strong> — The interconnected web of being and purpose</li>
                                <li><strong>Shape Meanings</strong> — Symbolic representations of truth beyond language</li>
                            </ul>
                            <a href="https://docs.getsuite.app/school" target="_blank" style="display: inline-block; margin-top: 16px; color: #a855f7; font-weight: 600; text-decoration: none;">
                                Explore SUITE School →
                            </a>
                        </div>
                    </details>
                </div>

                '''

# Find where to insert (before Giving Panel)
insert_marker = '<!-- Giving Panel -->'
insert_idx = content.find(insert_marker)

if insert_idx == -1:
    print("Could not find Giving Panel marker")
else:
    # Insert the new panel before Giving
    content = content[:insert_idx] + apologetics_panel + content[insert_idx:]
    print(f"Inserted Apologetics Arena panel at position {insert_idx}")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
