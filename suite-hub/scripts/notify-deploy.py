# Deployment Notification Script
# Run this after making changes to notify Discord that a deployment is complete
# Usage: python notify-deploy.py "App Name" "Change description"

import sys
import os
import json

# Discord webhook URL (set this in your environment or .env file)
WEBHOOK_URL = os.environ.get('DISCORD_DEPLOY_WEBHOOK', '')

def notify_discord(app_name, change_description):
    """Send deployment notification to Discord"""
    import urllib.request
    import urllib.error
    
    if not WEBHOOK_URL:
        print("⚠️ No DISCORD_DEPLOY_WEBHOOK set, skipping notification")
        return False
    
    message = {
        "content": None,
        "embeds": [{
            "title": f"🚀 Deployed to {app_name}!",
            "description": change_description,
            "color": 5763719,  # Green
            "footer": {
                "text": "Autonomous Coding System • Reload app to see changes"
            }
        }]
    }
    
    try:
        data = json.dumps(message).encode('utf-8')
        req = urllib.request.Request(
            WEBHOOK_URL,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req)
        print(f"✅ Discord notified: {app_name} - {change_description}")
        return True
    except Exception as e:
        print(f"❌ Failed to notify Discord: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python notify-deploy.py 'App Name' 'Change description'")
        sys.exit(1)
    
    app_name = sys.argv[1]
    change_desc = sys.argv[2]
    notify_discord(app_name, change_desc)
