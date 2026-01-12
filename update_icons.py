import requests

SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc4OTcxOCwiZXhwIjoyMDgzMzY1NzE4fQ.W8hqJClOZons4Vl9jMdcsApU0116YUZvchUTIfo1bSA'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

# Icon URLs - these are hosted on getsuite.app
ICON_URLS = {
    'cheshbon-reflections': 'https://getsuite.app/assets/icons/cheshbon-icon.jpg',
    'foodvitals': 'https://getsuite.app/assets/icons/foodvitals-icon.jpg',
    'remcast': 'https://getsuite.app/assets/icons/remcast-icon.jpg',
    'opticrep': 'https://getsuite.app/assets/icons/opticrep-icon.jpg',
    'trueform-ai': 'https://getsuite.app/assets/icons/trueform-icon.jpg',
}

print("Updating app icons in database...\n")

for slug, icon_url in ICON_URLS.items():
    r = requests.patch(
        f'{SUPABASE_URL}/rest/v1/apps?slug=eq.{slug}',
        headers=headers,
        json={'icon_url': icon_url}
    )
    status = "✓" if r.status_code == 204 else f"❌ {r.status_code}"
    print(f"  {slug}: {status}")

print("\nDone! Push to deploy, then refresh getsuite.app/apps.html")
