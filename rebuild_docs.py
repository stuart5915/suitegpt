"""
SUITE Docs Rebuild Script
Extracts content from existing docs and rebuilds with clean template
"""
import os
import re
from pathlib import Path

DOCS_DIR = Path("docs")
BACKUP_DIR = Path("docs/_backup")
CONTENT_DIR = Path("docs/_extracted")

# Create backup and extraction directories
BACKUP_DIR.mkdir(exist_ok=True)
CONTENT_DIR.mkdir(exist_ok=True)

# Clean template with proper nav, sidebar, and styles
TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} | SUITE Docs</title>
    <link rel="icon" type="image/png" href="../assets/suite-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../suite-styles.css">
    <link rel="stylesheet" href="../nav.css">
    <link rel="stylesheet" href="docs.css">
    <style>
        body {{
            font-family: 'Nunito', sans-serif;
            background: linear-gradient(135deg, #fff5f0 0%, #ffeef5 50%, #f0e6ff 100%);
            min-height: 100vh;
            overflow-x: hidden;
        }}
        .canvas-container {{
            width: 100%;
            min-height: 100vh;
            padding: 100px 24px 40px 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-sizing: border-box;
        }}
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav id="main-nav"></nav>
    <script src="docs-nav.js"></script>

    <div class="canvas-container">
        <div class="docs-container">
            <!-- Sidebar -->
            <aside class="docs-sidebar"></aside>
            <script src="sidebar.js"></script>

            <!-- Main Content -->
            <main class="docs-content">
{content}
            </main>
        </div>
    </div>
</body>
</html>
'''

def extract_title(html):
    """Extract page title from HTML"""
    match = re.search(r'<title>([^<|]+)', html)
    if match:
        return match.group(1).strip()
    return "SUITE Docs"

def extract_content(html):
    """Extract main content from docs-content div"""
    # Try to find docs-content div
    match = re.search(r'<main[^>]*class="docs-content"[^>]*>(.*?)</main>', html, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Try alternate: look for docs-content class on any element
    match = re.search(r'<div[^>]*class="docs-content"[^>]*>(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Fallback: try to find content between header and footer markers
    match = re.search(r'<!-- Main Content -->(.*?)(?:</main>|<!-- Footer)', html, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    return None

def process_docs():
    results = []
    html_files = list(DOCS_DIR.glob("*.html"))
    
    for html_file in html_files:
        filename = html_file.name
        
        # Read original file
        with open(html_file, 'r', encoding='utf-8') as f:
            original_html = f.read()
        
        # Backup original
        backup_path = BACKUP_DIR / filename
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(original_html)
        
        # Extract title and content
        title = extract_title(original_html)
        content = extract_content(original_html)
        
        if content:
            content_len = len(content)
            
            # Save extracted content
            content_path = CONTENT_DIR / f"{filename.replace('.html', '')}-content.html"
            with open(content_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Build new page from template
            new_html = TEMPLATE.format(title=title, content=content)
            
            # Write new file
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(new_html)
            
            results.append(f"✅ {filename}: {len(content)} chars extracted, rebuilt")
        else:
            results.append(f"⚠️ {filename}: Could not extract content (manual review needed)")
    
    return results

if __name__ == "__main__":
    print("Starting SUITE Docs Rebuild...")
    print(f"Found {len(list(DOCS_DIR.glob('*.html')))} HTML files")
    print()
    
    results = process_docs()
    
    print("\n=== RESULTS ===")
    for r in sorted(results):
        print(r)
    
    print(f"\nBackups saved to: {BACKUP_DIR}")
    print(f"Extracted content saved to: {CONTENT_DIR}")
    print("\nDone! Refresh your browser to see the new consistent docs.")
