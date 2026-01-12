# Add Content Marketplace section to developer-portal.html
# Run with: python add_marketplace.py

with open('developer-portal.html', 'r', encoding='latin-1') as f:
    content = f.read()

# The Content Marketplace promo section to add
marketplace_section = '''
    <!-- Content Marketplace Promo -->
    <section style="padding: 60px 24px; max-width: 900px; margin: 0 auto;">
        <a href="content.html" style="display: block; text-decoration: none; color: inherit;">
            <div style="background: linear-gradient(135deg, rgba(255,149,0,0.1), rgba(255,107,157,0.1)); border: 2px solid rgba(255,149,0,0.3); border-radius: 20px; padding: 32px; display: flex; align-items: center; gap: 24px; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 40px rgba(255,149,0,0.15)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
                <div style="font-size: 3rem;">🎨</div>
                <div style="flex: 1;">
                    <div style="font-size: 1.4rem; font-weight: 700; color: #ff9500; margin-bottom: 6px;">Content Marketplace</div>
                    <div style="color: #666;">Earn SUITE by creating videos, graphics, and copy for app developers. Post bounties or submit work.</div>
                </div>
                <div style="font-size: 1.5rem; color: #ff9500;">→</div>
            </div>
        </a>
    </section>
'''

# Find a good insertion point - after </section> that follows portal-hero
# Look for the video tutorials section and insert before it
if 'tutorials-section' in content:
    content = content.replace('<section class="tutorials-section">', marketplace_section + '\n    <section class="tutorials-section">')
elif 'Learn by Watching' in content:
    content = content.replace('Learn by Watching', marketplace_section + '\n        Learn by Watching')
else:
    # Fallback: insert after first </section>
    idx = content.find('</section>')
    if idx > 0:
        idx = content.find('</section>', idx + 1)  # Find second </section>
        if idx > 0:
            content = content[:idx+10] + marketplace_section + content[idx+10:]

with open('developer-portal.html', 'w', encoding='latin-1') as f:
    f.write(content)

print('Added Content Marketplace section to developer-portal.html')
print('Refresh your browser to see the changes.')
