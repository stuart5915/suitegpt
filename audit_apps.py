import requests
import json

url = 'https://rdsmdywbdiskxknluiym.supabase.co/rest/v1/apps?select=*'
headers = {'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc4OTcxOCwiZXhwIjoyMDgzMzY1NzE4fQ.W8hqJClOZons4Vl9jMdcsApU0116YUZvchUTIfo1bSA'}

r = requests.get(url, headers=headers)
apps = r.json()

# Save full JSON to file
with open('apps_audit.json', 'w') as f:
    json.dump(apps, f, indent=2)
print(f"Saved {len(apps)} apps to apps_audit.json")
