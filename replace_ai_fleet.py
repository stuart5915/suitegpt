"""
Replace the AI Fleet panel with a clean version featuring division tabs
"""

# Read the file
with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the AI Fleet Panel boundaries
start_marker = '<!-- AI Fleet Panel (Public) -->'
end_marker = '<!-- Earn Panel -->'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Start marker found: {start_idx != -1}")
    print(f"End marker found: {end_idx != -1}")
    exit(1)

# New AI Fleet Panel with Division Tabs
new_ai_fleet_panel = '''<!-- AI Fleet Panel (Public) -->
                <div id="panel-ai-fleet" class="section-panel">
                    <!-- Header with Title and Learn More -->
                    <div class="panel-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
                        <div>
                            <h2 class="panel-title" style="display: flex; align-items: center; gap: 12px;">
                                <img src="assets/emojis/clay-rocket.png" alt="" style="width: 32px; height: 32px;">
                                AI Fleet Command Center
                            </h2>
                            <p class="panel-desc">Autonomous systems building, deploying, and managing across multiple domains.</p>
                        </div>
                        <a href="docs/ai-fleet.html" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 10px 18px; border-radius: 100px; font-size: 0.85rem; font-weight: 700; text-decoration: none;">
                            <img src="assets/emojis/clay-book.png" alt="" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 6px;">Learn More
                        </a>
                    </div>

                    <!-- Division Tabs -->
                    <div id="fleetDivisionTabs" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid rgba(0,0,0,0.06);">
                        <button onclick="showFleetDivision('apps')" class="fleet-tab active" data-division="apps" style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; border: 2px solid #6366f1; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-radius: 100px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            <img src="assets/emojis/clay-phone.png" alt="" style="width: 20px; height: 20px;">
                            Apps
                            <span style="background: white; color: #6366f1; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 800;">LIVE</span>
                        </button>
                        <button onclick="showFleetDivision('robots')" class="fleet-tab" data-division="robots" style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; border: 2px solid #ddd; background: white; color: #666; border-radius: 100px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            <img src="assets/emojis/clay-gear.png" alt="" style="width: 20px; height: 20px;">
                            Robots
                            <span style="background: #f3f4f6; color: #888; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600;">SOON</span>
                        </button>
                        <button onclick="showFleetDivision('drones')" class="fleet-tab" data-division="drones" style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; border: 2px solid #ddd; background: white; color: #666; border-radius: 100px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            <img src="assets/emojis/clay-rocket.png" alt="" style="width: 20px; height: 20px;">
                            Drones
                            <span style="background: #f3f4f6; color: #888; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600;">SOON</span>
                        </button>
                        <button onclick="showFleetDivision('farms')" class="fleet-tab" data-division="farms" style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; border: 2px solid #ddd; background: white; color: #666; border-radius: 100px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            <img src="assets/emojis/clay-sparkles.png" alt="" style="width: 20px; height: 20px;">
                            Microfarms
                            <span style="background: #f3f4f6; color: #888; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600;">SOON</span>
                        </button>
                        <button onclick="showFleetDivision('ventures')" class="fleet-tab" data-division="ventures" style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; border: 2px solid #ddd; background: white; color: #666; border-radius: 100px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            <img src="assets/emojis/clay-coins.png" alt="" style="width: 20px; height: 20px;">
                            Web Ventures
                            <span style="background: #f3f4f6; color: #888; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600;">SOON</span>
                        </button>
                        <button onclick="showFleetDivision('external')" class="fleet-tab" data-division="external" style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; border: 2px solid #ddd; background: white; color: #666; border-radius: 100px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            <img src="assets/emojis/clay-chat.png" alt="" style="width: 20px; height: 20px;">
                            External AI
                            <span style="background: #f3f4f6; color: #888; padding: 2px 8px; border-radius: 100px; font-size: 0.7rem; font-weight: 600;">SOON</span>
                        </button>
                    </div>

                    <!-- APPS DIVISION (Active) -->
                    <div id="fleet-division-apps" class="fleet-division active">
                        <!-- TELOS Mode Hero -->
                        <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05)); border-radius: 20px; padding: 24px; margin-bottom: 24px; border: 2px solid rgba(99, 102, 241, 0.2); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
                            <div>
                                <h3 style="margin: 0 0 8px 0; font-size: 1.3rem; font-weight: 800; color: #2d1b4e; display: flex; align-items: center; gap: 10px;">
                                    <img src="assets/emojis/clay-target.png" alt="" style="width: 28px; height: 28px;">
                                    TELOS MODE
                                    <span style="position: relative; display: inline-block; cursor: help; margin-left: 6px;" title="">
                                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: rgba(99, 102, 241, 0.2); color: #6366f1; border-radius: 50%; font-size: 0.7rem; font-weight: 700;">?</span>
                                        <span class="telos-tooltip" style="position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%); width: 280px; background: #1a1a2e; color: white; padding: 14px; border-radius: 12px; font-size: 0.8rem; font-weight: 500; line-height: 1.5; text-align: left; opacity: 0; visibility: hidden; transition: all 0.2s; z-index: 9999; box-shadow: 0 8px 24px rgba(0,0,0,0.3); pointer-events: none;">
                                            <strong style="color: #ff9500;">This does NOT start/stop the watcher.</strong><br><br>
                                            OFF: Watcher only processes YOUR prompts (Discord, laptop, extensions)<br><br>
                                            ON: When queue is empty, AI finds its own tasks to work on autonomously<br><br>
                                            Your prompts ALWAYS have priority over TELOS tasks.
                                        </span>
                                    </span>
                                </h3>
                                <p id="telosStatusText" style="margin: 0; color: #5a4a6f; font-size: 0.95rem;">AI creates apps autonomously 24/7</p>
                            </div>
                            <!-- Toggle Switch -->
                            <div id="telosToggleControls" style="display: flex; align-items: center; gap: 12px;">
                                <span id="telosOffLabel" style="font-size: 0.9rem; font-weight: 600; color: #888;">OFF</span>
                                <label class="telos-switch" style="position: relative; display: inline-block; width: 80px; height: 40px; cursor: pointer;">
                                    <input type="checkbox" id="telosMainToggle" onchange="toggleTelosMode()" checked style="opacity: 0; width: 0; height: 0;">
                                    <span id="telosSlider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 40px; transition: 0.4s; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);"></span>
                                    <span id="telosKnob" style="position: absolute; height: 32px; width: 32px; left: 44px; bottom: 4px; background: white; border-radius: 50%; transition: 0.4s; box-shadow: 0 2px 6px rgba(0,0,0,0.2);"></span>
                                </label>
                                <span id="telosOnLabel" style="font-size: 0.9rem; font-weight: 700; color: #22c55e;">ON</span>
                            </div>
                        </div>
                        
                        <!-- Status Explanation -->
                        <div id="telosExplanation" style="margin-bottom: 24px; padding: 12px 16px; background: rgba(34, 197, 94, 0.1); border-radius: 12px; border-left: 4px solid #22c55e;">
                            <p style="margin: 0; font-size: 0.9rem; color: #16a34a; font-weight: 600;">ACTIVE: AI is researching markets, building apps, and deploying automatically.</p>
                        </div>

                        <!-- Forge Connection Status -->
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 12px 16px; background: white; border-radius: 12px; border: 1px solid rgba(0,0,0,0.06);">
                            <span style="width: 10px; height: 10px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite;"></span>
                            <span style="font-weight: 600; color: #16a34a;">
                                <img src="assets/emojis/clay-gear.png" alt="" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px;">
                                Forge (PC) Connected
                            </span>
                            <span style="margin-left: auto; font-size: 0.8rem; color: #888;">Last sync: Just now</span>
                        </div>

                        <!-- Stats Grid -->
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
                            <div style="text-align: center; padding: 20px; background: white; border-radius: 16px; border: 1px solid rgba(0,0,0,0.06);">
                                <div id="aiAppsTotal" style="font-size: 2rem; font-weight: 900; color: #6366f1;">0</div>
                                <div style="font-size: 0.85rem; color: #888;">Total AI Apps</div>
                            </div>
                            <div style="text-align: center; padding: 20px; background: white; border-radius: 16px; border: 1px solid rgba(0,0,0,0.06);">
                                <div id="aiAppsToday" style="font-size: 2rem; font-weight: 900; color: #22c55e;">0</div>
                                <div style="font-size: 0.85rem; color: #888;">Created Today</div>
                            </div>
                            <div style="text-align: center; padding: 20px; background: white; border-radius: 16px; border: 1px solid rgba(0,0,0,0.06);">
                                <div id="aiAppsInProgress" style="font-size: 2rem; font-weight: 900; color: #f59e0b;">0</div>
                                <div style="font-size: 0.85rem; color: #888;">In Progress</div>
                            </div>
                            <div style="text-align: center; padding: 20px; background: white; border-radius: 16px; border: 1px solid rgba(0,0,0,0.06);">
                                <div id="aiTotalIterations" style="font-size: 2rem; font-weight: 900; color: #8b5cf6;">0</div>
                                <div style="font-size: 0.85rem; color: #888;">Total Iterations</div>
                            </div>
                        </div>

                        <!-- Two Column Layout -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                            <!-- Live Activity Feed -->
                            <div style="background: #1a1a2e; border-radius: 16px; padding: 20px; color: white; max-height: 400px; overflow: hidden;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                    <h4 style="margin: 0; font-weight: 700;">Live Activity Feed</h4>
                                    <span style="font-size: 0.75rem; color: #888; animation: pulse 2s infinite;">STREAMING</span>
                                </div>
                                <div id="aiActivityFeed" style="font-family: 'Courier New', monospace; font-size: 0.8rem; line-height: 1.8; max-height: 320px; overflow-y: auto;">
                                    <div style="color: #888;">Loading activity feed...</div>
                                </div>
                            </div>

                            <!-- TELOS Configuration -->
                            <div id="aiFleetConfigPanel" style="background: white; border-radius: 16px; padding: 24px; border: 1px solid rgba(0,0,0,0.06);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                    <h4 style="margin: 0; font-weight: 800; font-size: 1.1rem; color: #2d1b4e;">
                                        <img src="assets/emojis/clay-target.png" alt="" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 6px;">
                                        TELOS Configuration
                                    </h4>
                                    <span style="font-size: 0.75rem; color: #888;">Owner Only</span>
                                </div>
                                
                                <!-- Quick Settings -->
                                <details open style="margin-bottom: 12px; background: rgba(99, 102, 241, 0.05); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.2);">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 700; color: #6366f1;">Autonomous Behavior</summary>
                                    <div style="padding: 0 16px 16px;">
                                        <label style="font-size: 0.8rem; font-weight: 600; color: #555; display: block; margin-bottom: 8px;">Research Focus</label>
                                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                            <span class="focus-pill active" onclick="toggleFocusPill(this)" style="padding: 6px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;">Productivity</span>
                                            <span class="focus-pill active" onclick="toggleFocusPill(this)" style="padding: 6px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;">Health</span>
                                            <span class="focus-pill active" onclick="toggleFocusPill(this)" style="padding: 6px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;">Finance</span>
                                            <span class="focus-pill" onclick="toggleFocusPill(this)" style="padding: 6px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; cursor: pointer; background: rgba(99, 102, 241, 0.1); color: #6366f1;">Social</span>
                                            <span class="focus-pill" onclick="toggleFocusPill(this)" style="padding: 6px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600; cursor: pointer; background: rgba(99, 102, 241, 0.1); color: #6366f1;">Education</span>
                                        </div>
                                    </div>
                                </details>
                                
                                <details style="margin-bottom: 12px; background: rgba(251, 191, 36, 0.05); border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.2);">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 700; color: #f59e0b;">Scheduling</summary>
                                    <div style="padding: 0 16px 16px;">
                                        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                                            <div style="flex: 1;">
                                                <label style="font-size: 0.75rem; color: #555; display: block; margin-bottom: 4px;">Max Apps/Day</label>
                                                <input type="number" value="6" style="width: 100%; padding: 8px; border: 2px solid #eee; border-radius: 8px; font-weight: 600;">
                                            </div>
                                            <div style="flex: 1;">
                                                <label style="font-size: 0.75rem; color: #555; display: block; margin-bottom: 4px;">Iterations</label>
                                                <input type="number" value="50" style="width: 100%; padding: 8px; border: 2px solid #eee; border-radius: 8px; font-weight: 600;">
                                            </div>
                                        </div>
                                    </div>
                                </details>
                                
                                <details style="margin-bottom: 16px; background: rgba(34, 197, 94, 0.05); border-radius: 12px; border: 1px solid rgba(34, 197, 94, 0.2);">
                                    <summary style="padding: 12px 16px; cursor: pointer; font-weight: 700; color: #16a34a;">Workflow</summary>
                                    <div style="padding: 0 16px 16px;">
                                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                                            <input type="checkbox" checked style="width: 16px; height: 16px; accent-color: #22c55e;">
                                            <span style="font-size: 0.85rem; font-weight: 600;">Auto-Deploy</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                                            <input type="checkbox" checked style="width: 16px; height: 16px; accent-color: #22c55e;">
                                            <span style="font-size: 0.85rem; font-weight: 600;">GitHub Auto-Create</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                            <input type="checkbox" checked style="width: 16px; height: 16px; accent-color: #22c55e;">
                                            <span style="font-size: 0.85rem; font-weight: 600;">Discord Notifications</span>
                                        </label>
                                    </div>
                                </details>
                                
                                <button onclick="saveTelosConfig()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700; cursor: pointer;">
                                    Save Configuration
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- ROBOTS DIVISION (Future) -->
                    <div id="fleet-division-robots" class="fleet-division" style="display: none;">
                        <div style="text-align: center; padding: 60px 40px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.02)); border-radius: 20px; border: 2px dashed rgba(99, 102, 241, 0.2);">
                            <img src="assets/emojis/clay-gear.png" alt="" style="width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5;">
                            <h3 style="margin: 0 0 12px; color: #2d1b4e; font-size: 1.5rem; font-weight: 800;">Robots Division</h3>
                            <p style="margin: 0 0 20px; color: #666; font-size: 1rem;">Physical automation systems, robotic arms, manufacturing bots</p>
                            <span style="display: inline-block; padding: 8px 20px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 100px; font-weight: 700; font-size: 0.9rem;">Coming in Phase 3</span>
                        </div>
                    </div>

                    <!-- DRONES DIVISION (Future) -->
                    <div id="fleet-division-drones" class="fleet-division" style="display: none;">
                        <div style="text-align: center; padding: 60px 40px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.02)); border-radius: 20px; border: 2px dashed rgba(99, 102, 241, 0.2);">
                            <img src="assets/emojis/clay-rocket.png" alt="" style="width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5;">
                            <h3 style="margin: 0 0 12px; color: #2d1b4e; font-size: 1.5rem; font-weight: 800;">Drones Division</h3>
                            <p style="margin: 0 0 20px; color: #666; font-size: 1rem;">Aerial delivery systems, surveillance, autonomous flight networks</p>
                            <span style="display: inline-block; padding: 8px 20px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 100px; font-weight: 700; font-size: 0.9rem;">Coming in Phase 4</span>
                        </div>
                    </div>

                    <!-- MICROFARMS DIVISION (Future) -->
                    <div id="fleet-division-farms" class="fleet-division" style="display: none;">
                        <div style="text-align: center; padding: 60px 40px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(22, 163, 74, 0.02)); border-radius: 20px; border: 2px dashed rgba(34, 197, 94, 0.2);">
                            <img src="assets/emojis/clay-sparkles.png" alt="" style="width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5;">
                            <h3 style="margin: 0 0 12px; color: #2d1b4e; font-size: 1.5rem; font-weight: 800;">Microfarms Division</h3>
                            <p style="margin: 0 0 20px; color: #666; font-size: 1rem;">Autonomous vertical farms, indoor growing systems, sustainable food production</p>
                            <span style="display: inline-block; padding: 8px 20px; background: rgba(34, 197, 94, 0.1); color: #16a34a; border-radius: 100px; font-weight: 700; font-size: 0.9rem;">Coming in Phase 5</span>
                        </div>
                    </div>

                    <!-- WEB VENTURES DIVISION (Future) -->
                    <div id="fleet-division-ventures" class="fleet-division" style="display: none;">
                        <div style="text-align: center; padding: 60px 40px; background: linear-gradient(135deg, rgba(255, 149, 0, 0.05), rgba(255, 107, 157, 0.02)); border-radius: 20px; border: 2px dashed rgba(255, 149, 0, 0.2);">
                            <img src="assets/emojis/clay-coins.png" alt="" style="width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5;">
                            <h3 style="margin: 0 0 12px; color: #2d1b4e; font-size: 1.5rem; font-weight: 800;">Web Ventures Division</h3>
                            <p style="margin: 0 0 20px; color: #666; font-size: 1rem;">AI-driven online businesses: dropshipping, content creation, SaaS products - all funding the treasury</p>
                            <span style="display: inline-block; padding: 8px 20px; background: rgba(255, 149, 0, 0.1); color: #f59e0b; border-radius: 100px; font-weight: 700; font-size: 0.9rem;">Coming in Phase 3</span>
                        </div>
                    </div>

                    <!-- EXTERNAL AI DIVISION (Future) -->
                    <div id="fleet-division-external" class="fleet-division" style="display: none;">
                        <div style="text-align: center; padding: 60px 40px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.02)); border-radius: 20px; border: 2px dashed rgba(99, 102, 241, 0.2);">
                            <img src="assets/emojis/clay-chat.png" alt="" style="width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5;">
                            <h3 style="margin: 0 0 12px; color: #2d1b4e; font-size: 1.5rem; font-weight: 800;">External AI Division</h3>
                            <p style="margin: 0 0 20px; color: #666; font-size: 1rem;">Integrations with OpenAI, Anthropic, Google, and other AI ecosystems</p>
                            <span style="display: inline-block; padding: 8px 20px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 100px; font-weight: 700; font-size: 0.9rem;">Partnerships Forming</span>
                        </div>
                    </div>
                </div>

                '''

# Replace the section
new_content = content[:start_idx] + new_ai_fleet_panel + content[end_idx:]

# Write back
with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Replaced AI Fleet panel (chars {start_idx} to {end_idx})")
print("New panel includes division tabs: Apps, Robots, Drones, Microfarms, Web Ventures, External AI")
