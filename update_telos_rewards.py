"""
Update the TELOS arena with new economics:
- Lower cost: ~$0.002 in SUITE (approximately 0.5 SUITE at current prices)
- Add rewards section for novel/accepted submissions
"""

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find and replace the cost section  
old_cost = '''<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px 16px; background: rgba(255, 149, 0, 0.1); border-radius: 10px;">
                                <span style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Cost:</span>
                                <span style="font-weight: 700; color: #ff9500;">10 SUITE → Giving Fund</span>
                            </div>'''

new_cost_and_rewards = '''<div style="margin-bottom: 16px; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    <span style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Submission Cost:</span>
                                    <span style="font-weight: 700; color: #ff9500;">0.5 SUITE <span style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">(~$0.002)</span></span>
                                </div>
                                <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-bottom: 8px;">🏆 Rewards for Accepted Submissions:</div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                                    <div style="background: rgba(34, 197, 94, 0.1); padding: 8px 12px; border-radius: 8px; border-left: 3px solid #22c55e;">
                                        <span style="color: #22c55e; font-weight: 700;">+10 SUITE</span>
                                        <span style="color: rgba(255,255,255,0.6);"> Supporting Claim</span>
                                    </div>
                                    <div style="background: rgba(255, 149, 0, 0.1); padding: 8px 12px; border-radius: 8px; border-left: 3px solid #ff9500;">
                                        <span style="color: #ff9500; font-weight: 700;">+25 SUITE</span>
                                        <span style="color: rgba(255,255,255,0.6);"> Novel Attack</span>
                                    </div>
                                    <div style="background: rgba(168, 85, 247, 0.1); padding: 8px 12px; border-radius: 8px; border-left: 3px solid #a855f7;">
                                        <span style="color: #a855f7; font-weight: 700;">+50 SUITE</span>
                                        <span style="color: rgba(255,255,255,0.6);"> Accepted Refinement</span>
                                    </div>
                                    <div style="background: rgba(255, 107, 157, 0.1); padding: 8px 12px; border-radius: 8px; border-left: 3px solid #ff6b9d;">
                                        <span style="color: #ff6b9d; font-weight: 700;">+100 SUITE</span>
                                        <span style="color: rgba(255,255,255,0.6);"> New Principle</span>
                                    </div>
                                </div>
                            </div>'''

if old_cost in content:
    content = content.replace(old_cost, new_cost_and_rewards)
    print("Updated cost and added rewards section!")
else:
    print("Could not find cost section to replace")

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
