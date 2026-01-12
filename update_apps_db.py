import requests
import json

SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc4OTcxOCwiZXhwIjoyMDgzMzY1NzE4fQ.W8hqJClOZons4Vl9jMdcsApU0116YUZvchUTIfo1bSA'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# 1. Delete MindMap placeholder
print("1. Deleting MindMap placeholder...")
r = requests.delete(
    f'{SUPABASE_URL}/rest/v1/apps?slug=eq.mindmap',
    headers=headers
)
print(f"   Status: {r.status_code}")

# 2. Add REMCast
print("\n2. Adding REMCast...")
remcast = {
    "name": "REMCast",
    "slug": "remcast",
    "description": "AI-powered podcast created from your REM sleep dreams. Record your dreams and let AI transform them into engaging audio stories.",
    "icon_url": None,  # Will be updated when user generates icon
    "creator_name": "Stuart Hollinger",
    "app_url": "https://remcast.getsuite.app",
    "category": "lifestyle",
    "status": "approved"
}
r = requests.post(
    f'{SUPABASE_URL}/rest/v1/apps',
    headers=headers,
    json=remcast
)
print(f"   Status: {r.status_code}")
if r.status_code >= 400:
    print(f"   Error: {r.text}")

# 3. Add TrueForm AI
print("\n3. Adding TrueForm AI...")
trueform = {
    "name": "TrueForm AI",
    "slug": "trueform-ai",
    "description": "AI physiotherapist for posture and movement analysis. Get real-time feedback on your form and personalized exercises.",
    "icon_url": None,  # Will be updated when user generates icon
    "creator_name": "Stuart Hollinger",
    "app_url": "https://trueform.getsuite.app",
    "category": "health",
    "status": "approved"
}
r = requests.post(
    f'{SUPABASE_URL}/rest/v1/apps',
    headers=headers,
    json=trueform
)
print(f"   Status: {r.status_code}")
if r.status_code >= 400:
    print(f"   Error: {r.text}")

# 4. Verify final state
print("\n4. Verifying apps in database...")
r = requests.get(
    f'{SUPABASE_URL}/rest/v1/apps?select=name,slug,status,icon_url',
    headers={'apikey': SUPABASE_KEY}
)
apps = r.json()
print(f"\nTotal apps: {len(apps)}")
for app in apps:
    icon_status = "✓" if app.get('icon_url') else "❌ NEEDS ICON"
    print(f"  - {app['name']} ({app['status']}) {icon_status}")
