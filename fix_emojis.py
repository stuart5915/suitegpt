import re
import os

def fix_file(filepath):
    print(f"Processing {filepath}...")
    
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    original = content
    
    # Fix earn-icon spans based on following label
    content = re.sub(
        r'<span class="earn-icon"></span>\s*<span class="earn-label">Watch Ads',
        '<span class="earn-icon">📺</span>\n                            <span class="earn-label">Watch Ads',
        content
    )
    content = re.sub(
        r'<span class="earn-icon"></span>\s*<span class="earn-label">Try Apps',
        '<span class="earn-icon">📱</span>\n                            <span class="earn-label">Try Apps',
        content
    )
    content = re.sub(
        r'<span class="earn-icon"></span>\s*<span class="earn-label">Refer Friends',
        '<span class="earn-icon">👥</span>\n                            <span class="earn-label">Refer Friends',
        content
    )
    content = re.sub(
        r'<span class="earn-icon"></span>\s*<span class="earn-label">Hold SUITE',
        '<span class="earn-icon">💎</span>\n                            <span class="earn-label">Hold SUITE',
        content
    )
    
    # Fix ?? Value to 📈 Value
    content = content.replace('?? Value', '📈 Value')
    content = content.replace('>?? <', '>→ <')
    
    # Fix community quote avatars
    content = re.sub(r'<div class="quote-avatar"></div>', '<div class="quote-avatar">😊</div>', content)
    content = re.sub(r'<div class="quote-avatar">\s*</div>', '<div class="quote-avatar">😊</div>', content)
    
    # Fix option icons that are empty
    content = re.sub(
        r'<div class="option-icon"></div>\s*<div class="option-content">\s*<div class="option-title">Video Tutorials',
        '<div class="option-icon">🎥</div>\n                    <div class="option-content">\n                        <div class="option-title">Video Tutorials',
        content
    )
    content = re.sub(
        r'<div class="option-icon"></div>\s*<div class="option-content">\s*<div class="option-title">Documentation',
        '<div class="option-icon">📖</div>\n                    <div class="option-content">\n                        <div class="option-title">Documentation',
        content
    )
    content = re.sub(
        r'<div class="option-icon"></div>\s*<div class="option-content">\s*<div class="option-title">Dev Dashboard',
        '<div class="option-icon">⚙️</div>\n                    <div class="option-content">\n                        <div class="option-title">Dev Dashboard',
        content
    )
    content = re.sub(
        r'<div class="option-icon"></div>\s*<div class="option-content">\s*<div class="option-title">Get Started',
        '<div class="option-icon">🚀</div>\n                    <div class="option-content">\n                        <div class="option-title">Get Started',
        content
    )
    
    # Fix activity feed patterns
    content = re.sub(r'<span class="activity-icon">\s*</span>', '<span class="activity-icon">✨</span>', content)
    
    # Fix See All Apps arrow
    content = re.sub(r'See All Apps\s*\?', 'See All Apps →', content)
    content = re.sub(r'See\s+All Apps \?', 'See All Apps →', content)
    
    # Fix Subscribe on YouTube
    content = re.sub(r'\?\? Subscribe on YouTube', '▶️ Subscribe on YouTube', content)
    
    # Fix Connect Wallet
    content = re.sub(r'\?\? Connect Wallet', '🔗 Connect Wallet', content)
    
    # Fix remaining stray question mark pairs
    # Look for patterns like >??</span> and replace with nothing or proper content
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  -> Fixed!")
        return True
    print(f"  -> No changes needed")
    return False

# Process all HTML files  
files = ['index.html', 'earn.html', 'developer-portal.html', 'wallet.html', 'apps.html', 'boost.html', 'giving.html', 'start-building.html']
fixed = 0

for f in files:
    if os.path.exists(f):
        if fix_file(f):
            fixed += 1

print(f"\n✅ Fixed {fixed} files")
