"""
Replace the Apologetics Arena panel with the TELOS-focused version
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the current apologetics panel
start_marker = '<!-- Apologetics Arena Panel -->'
end_marker = '<!-- Giving Panel -->'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Start found: {start_idx != -1}, End found: {end_idx != -1}")
    exit(1)

# New TELOS-focused panel
new_panel = '''<!-- Apologetics Arena Panel -->
                <div id="panel-apologetics" class="section-panel">
                    <!-- Header -->
                    <div class="panel-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
                        <div>
                            <h2 class="panel-title" style="display: flex; align-items: center; gap: 12px;">
                                <img src="assets/emojis/clay-trophy.png" alt="" style="width: 32px; height: 32px;">
                                TELOS Refinement Arena
                            </h2>
                            <p class="panel-desc">Stress-test and strengthen the master constitution that governs all SUITE AI systems.</p>
                        </div>
                        <a href="TELOS.md" target="_blank" style="background: linear-gradient(135deg, #a855f7, #6366f1); color: white; padding: 10px 18px; border-radius: 100px; font-size: 0.85rem; font-weight: 700; text-decoration: none;">
                            <img src="assets/emojis/clay-book.png" alt="" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 6px;">View TELOS.md
                        </a>
                    </div>

                    <!-- Governance Explainer -->
                    <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.05)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                        <h3 style="margin: 0 0 12px; font-size: 1.1rem; color: #a855f7; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.3rem;">🏛️</span> Governance Model
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px;">
                                <div style="font-weight: 700; color: #22c55e; margin-bottom: 8px;">📍 Current Phase: Founder Stewardship</div>
                                <p style="margin: 0; font-size: 0.9rem; color: rgba(255,255,255,0.7); line-height: 1.6;">
                                    TELOS.md is maintained by Stuart Hollinger. All refinements are publicly documented, 
                                    but final approval rests with the founder during this bootstrap phase.
                                </p>
                            </div>
                            <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px;">
                                <div style="font-weight: 700; color: #ff9500; margin-bottom: 8px;">🔮 Future Phase: Council Governance</div>
                                <p style="margin: 0; font-size: 0.9rem; color: rgba(255,255,255,0.7); line-height: 1.6;">
                                    Holders who <strong style="color: #ff9500;">permanently lock SUITE</strong> in the Treasury 
                                    become Council members with voting rights on TELOS.md amendments.
                                </p>
                            </div>
                        </div>
                        <p style="margin: 16px 0 0; font-size: 0.85rem; color: rgba(255,255,255,0.5); text-align: center; font-style: italic;">
                            "Locked forever = permanent voice in SUITE's direction"
                        </p>
                    </div>

                    <!-- Stats -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 16px; color: white;">
                            <div style="font-size: 2rem; font-weight: 900;">5</div>
                            <div style="font-size: 0.8rem; opacity: 0.9;">Core Principles</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(255, 149, 0, 0.2);">
                            <div id="totalRefinements" style="font-size: 2rem; font-weight: 900; color: #ff9500;">0</div>
                            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">Refinements Submitted</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(168, 85, 247, 0.2);">
                            <div id="novelAttacksCount" style="font-size: 2rem; font-weight: 900; color: #a855f7;">0</div>
                            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">Novel Attacks Refuted</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(34, 197, 94, 0.2);">
                            <div style="font-size: 2rem; font-weight: 900; color: #22c55e;">v1.0</div>
                            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">Current Version</div>
                        </div>
                    </div>

                    <!-- Core Principle Box -->
                    <div style="background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
                        <div style="font-weight: 700; color: #22c55e; margin-bottom: 4px;">CORE PRINCIPLE #1</div>
                        <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 1.1rem;">Truth wins over untruth. Always.</p>
                    </div>

                    <!-- Two Column Layout -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        
                        <!-- TELOS.md Viewer -->
                        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 149, 0, 0.1);">
                            <h3 style="margin: 0 0 16px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                                <img src="assets/emojis/clay-book.png" alt="" style="width: 24px; height: 24px;">
                                TELOS.md Principles
                            </h3>
                            
                            <div id="telosPrinciples" style="max-height: 350px; overflow-y: auto;">
                                <!-- Principle 1 -->
                                <details style="margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 10px; border-left: 3px solid #22c55e;">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 600; color: white;">
                                        1. Truth Over Untruth
                                        <span style="float: right; font-size: 0.75rem; color: rgba(255,255,255,0.5);">0 claims | 0 attacks</span>
                                    </summary>
                                    <div style="padding: 0 16px 16px; color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                                        Truth wins. Always. All AI outputs must be grounded in verifiable truth.
                                    </div>
                                </details>
                                
                                <!-- Principle 2 -->
                                <details style="margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 10px; border-left: 3px solid #22c55e;">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 600; color: white;">
                                        2. Human Flourishing
                                        <span style="float: right; font-size: 0.75rem; color: rgba(255,255,255,0.5);">0 claims | 0 attacks</span>
                                    </summary>
                                    <div style="padding: 0 16px 16px; color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                                        All systems exist to serve human flourishing — spiritually, mentally, physically, and financially.
                                    </div>
                                </details>
                                
                                <!-- Principle 3 -->
                                <details style="margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 10px; border-left: 3px solid #22c55e;">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 600; color: white;">
                                        3. Transparency
                                        <span style="float: right; font-size: 0.75rem; color: rgba(255,255,255,0.5);">0 claims | 0 attacks</span>
                                    </summary>
                                    <div style="padding: 0 16px 16px; color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                                        All operations must be visible and auditable. No hidden agendas.
                                    </div>
                                </details>
                                
                                <!-- Principle 4 -->
                                <details style="margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 10px; border-left: 3px solid #22c55e;">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 600; color: white;">
                                        4. Sustainability
                                        <span style="float: right; font-size: 0.75rem; color: rgba(255,255,255,0.5);">0 claims | 0 attacks</span>
                                    </summary>
                                    <div style="padding: 0 16px 16px; color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                                        The ecosystem must be self-sustaining and perpetual.
                                    </div>
                                </details>
                                
                                <!-- Principle 5 -->
                                <details style="margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 10px; border-left: 3px solid #a855f7;">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 600; color: white;">
                                        5. Alignment with Creator's Intent
                                        <span style="float: right; font-size: 0.75rem; color: rgba(255,255,255,0.5);">0 claims | 0 attacks</span>
                                    </summary>
                                    <div style="padding: 0 16px 16px; color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                                        All AI behavior aligns with Christian values as interpreted through Scripture.
                                    </div>
                                </details>
                            </div>
                        </div>
                        
                        <!-- Submit Refinement Form -->
                        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 149, 0, 0.1);">
                            <h3 style="margin: 0 0 16px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                                <img src="assets/emojis/clay-chat.png" alt="" style="width: 24px; height: 24px;">
                                Submit Refinement
                            </h3>
                            
                            <div style="margin-bottom: 12px;">
                                <label style="font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 8px;">Target Principle</label>
                                <select id="targetPrinciple" style="width: 100%; padding: 12px; border: 2px solid rgba(255, 149, 0, 0.2); border-radius: 10px; background: rgba(0,0,0,0.2); color: white; font-size: 0.95rem;">
                                    <option value="1">1. Truth Over Untruth</option>
                                    <option value="2">2. Human Flourishing</option>
                                    <option value="3">3. Transparency</option>
                                    <option value="4">4. Sustainability</option>
                                    <option value="5">5. Alignment with Creator's Intent</option>
                                    <option value="new">+ Propose New Principle</option>
                                </select>
                            </div>
                            
                            <div style="margin-bottom: 12px;">
                                <label style="font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 8px;">Type</label>
                                <div style="display: flex; gap: 10px;">
                                    <label style="flex: 1; padding: 10px; background: rgba(34, 197, 94, 0.1); border: 2px solid rgba(34, 197, 94, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="support" style="display: none;">
                                        <span style="color: #22c55e; font-weight: 600;">✅ Support</span>
                                    </label>
                                    <label style="flex: 1; padding: 10px; background: rgba(255, 149, 0, 0.1); border: 2px solid rgba(255, 149, 0, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="attack" checked style="display: none;">
                                        <span style="color: #ff9500; font-weight: 600;">⚔️ Attack</span>
                                    </label>
                                    <label style="flex: 1; padding: 10px; background: rgba(168, 85, 247, 0.1); border: 2px solid rgba(168, 85, 247, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="refine" style="display: none;">
                                        <span style="color: #a855f7; font-weight: 600;">✨ Refine</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div style="margin-bottom: 16px;">
                                <label style="font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 8px;">Your Argument</label>
                                <textarea id="challengeInput" placeholder="Describe your attack, supporting evidence, or proposed refinement..." style="width: 100%; min-height: 100px; padding: 14px; border: 2px solid rgba(255, 149, 0, 0.2); border-radius: 12px; background: rgba(0,0,0,0.2); color: white; font-size: 0.95rem; resize: vertical;"></textarea>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px 16px; background: rgba(255, 149, 0, 0.1); border-radius: 10px;">
                                <span style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Cost:</span>
                                <span style="font-weight: 700; color: #ff9500;">10 SUITE → Giving Fund</span>
                            </div>
                            
                            <button onclick="submitChallenge()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ff9500, #ff6b9d); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer;">
                                Submit for Review
                            </button>
                        </div>
                    </div>

                    <!-- Beyond Good and Evil -->
                    <details style="margin-top: 24px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 16px;">
                        <summary style="padding: 16px 20px; cursor: pointer; font-weight: 700; color: #a855f7;">
                            Beyond Good and Evil — Meta-Perspectives
                        </summary>
                        <div style="padding: 0 20px 20px; color: rgba(255,255,255,0.8); line-height: 1.7;">
                            <p>While TELOS.md operates on clear principles, the SUITE School acknowledges deeper frameworks:</p>
                            <ul style="margin: 12px 0; padding-left: 20px;">
                                <li><strong>Moment View</strong> — Reality through present-moment consciousness</li>
                                <li><strong>Existential Matrix</strong> — The interconnected web of being</li>
                                <li><strong>Shape Meanings</strong> — Truth beyond language</li>
                            </ul>
                            <a href="https://docs.getsuite.app/school" target="_blank" style="color: #a855f7; font-weight: 600;">Explore SUITE School →</a>
                        </div>
                    </details>
                </div>

                '''

# Replace the panel
new_content = content[:start_idx] + new_panel + content[end_idx:]

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replaced Apologetics Arena with TELOS Refinement Arena!")
