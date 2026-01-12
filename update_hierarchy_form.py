"""
Update the submission form to support hierarchical positioning
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find and replace the type radio buttons with hierarchy options
old_type_section = '''<div style="margin-bottom: 12px;">
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
                            </div>'''

new_type_section = '''<div style="margin-bottom: 12px;">
                                <label style="font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 8px;">Position</label>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                    <label style="padding: 10px 8px; background: rgba(168, 85, 247, 0.1); border: 2px solid rgba(168, 85, 247, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="above" style="display: none;">
                                        <span style="color: #a855f7; font-weight: 600;">↑ Above</span>
                                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">Higher tier</div>
                                    </label>
                                    <label style="padding: 10px 8px; background: rgba(255, 149, 0, 0.1); border: 2px solid rgba(255, 149, 0, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="alongside" checked style="display: none;">
                                        <span style="color: #ff9500; font-weight: 600;">↔ Alongside</span>
                                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">Equal weight</div>
                                    </label>
                                    <label style="padding: 10px 8px; background: rgba(34, 197, 94, 0.1); border: 2px solid rgba(34, 197, 94, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="below" style="display: none;">
                                        <span style="color: #22c55e; font-weight: 600;">↓ Below</span>
                                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">Sub-principle</div>
                                    </label>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px;">
                                    <label style="padding: 10px 8px; background: rgba(255, 107, 157, 0.1); border: 2px solid rgba(255, 107, 157, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="refine" style="display: none;">
                                        <span style="color: #ff6b9d; font-weight: 600;">✏️ Refine</span>
                                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">Edit wording</div>
                                    </label>
                                    <label style="padding: 10px 8px; background: rgba(239, 68, 68, 0.1); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 10px; cursor: pointer; text-align: center;">
                                        <input type="radio" name="submissionType" value="challenge" style="display: none;">
                                        <span style="color: #ef4444; font-weight: 600;">⚔️ Challenge</span>
                                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">Test strength</div>
                                    </label>
                                </div>
                            </div>'''

if old_type_section in content:
    content = content.replace(old_type_section, new_type_section)
    print("Updated submission types to hierarchy positions!")
else:
    print("Could not find type section to replace")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
