# TELOS Watcher - Autonomous App Generation
# 
# This is a simplified watcher that ONLY handles TELOS autonomous mode.
# No prompts table, no pyautogui, no window management.
#
# USAGE:
#   python telos_watcher.py
#
# FLOW:
#   1. Check if TELOS mode is enabled in ai_config table
#   2. When enabled, generate ideas via telos_generator
#   3. Check for approved ideas and log activity
#   4. Sleep and repeat

import os
import sys
import time
import json
import requests
from datetime import datetime

# Import TELOS modules
try:
    import telos_generator as telos
    TELOS_AVAILABLE = True
    print('[INIT] ✅ TELOS generator loaded')
except ImportError as e:
    TELOS_AVAILABLE = False
    print(f'[INIT] ❌ TELOS generator not available: {e}')
    sys.exit(1)

# ═══ CONFIGURATION ═══
SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM'

POLL_INTERVAL = 30  # Check every 30 seconds
IDEA_GENERATION_COOLDOWN = 300  # 5 minutes between idea generations

# ═══ STATE ═══
last_generation_time = 0
was_enabled = False


def log_activity(event_type, message):
    """Log activity to ai_activity_log table for dashboard feed."""
    try:
        requests.post(
            f'{SUPABASE_URL}/rest/v1/ai_activity_log',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'event_type': event_type,
                'message': message,
                'timestamp': datetime.now().isoformat()
            },
            timeout=10
        )
    except Exception as e:
        print(f'[LOG] Failed to log activity: {e}')


def check_telos_enabled():
    """Check if TELOS mode is enabled in ai_config table."""
    try:
        response = requests.get(
            f'{SUPABASE_URL}/rest/v1/ai_config?key=eq.telos_enabled&select=value',
            headers={'apikey': SUPABASE_KEY},
            timeout=10
        )
        print(f'[DEBUG] ai_config response: {response.status_code} - {response.text[:200]}')
        if response.ok:
            data = response.json()
            if data and len(data) > 0:
                return data[0].get('value') == 'true'
        return False
    except Exception as e:
        print(f'[ERROR] Failed to check TELOS status: {e}')
        return False


def get_stats():
    """Get current TELOS stats for display."""
    try:
        # Count ideas by status
        response = requests.get(
            f'{SUPABASE_URL}/rest/v1/telos_ideas?select=status',
            headers={'apikey': SUPABASE_KEY},
            timeout=10
        )
        if response.ok:
            ideas = response.json()
            total = len(ideas)
            pending = sum(1 for i in ideas if i.get('status') == 'pending')
            approved = sum(1 for i in ideas if i.get('status') == 'approved')
            building = sum(1 for i in ideas if i.get('status') == 'building')
            return {'total': total, 'pending': pending, 'approved': approved, 'building': building}
    except:
        pass
    return {'total': 0, 'pending': 0, 'approved': 0, 'building': 0}


def run_idea_generation():
    """Generate new app ideas using TELOS."""
    global last_generation_time
    
    print('[TELOS] 🤖 Starting idea generation...')
    log_activity('telos_research', 'Starting market research and idea generation...')
    
    try:
        # Check if we can generate (respects daily limits)
        can_generate, reason = telos.check_limits()
        if not can_generate:
            print(f'[TELOS] ⏳ Cannot generate: {reason}')
            return False
        
        # Run the TELOS cycle
        success = telos.run_telos_cycle()
        
        if success:
            last_generation_time = time.time()
            print('[TELOS] ✅ Ideas generated successfully!')
            return True
        else:
            print('[TELOS] ⚠️ Generation returned false')
            return False
            
    except Exception as e:
        print(f'[TELOS] ❌ Generation failed: {e}')
        log_activity('telos_error', f'Idea generation failed: {str(e)[:100]}')
        return False


def main():
    global was_enabled, last_generation_time
    
    print('=' * 60)
    print('TELOS AUTONOMOUS WATCHER')
    print('=' * 60)
    print(f'Supabase: {SUPABASE_URL}')
    print(f'Poll Interval: {POLL_INTERVAL}s')
    print(f'Generation Cooldown: {IDEA_GENERATION_COOLDOWN}s')
    print('')
    print('Toggle TELOS mode ON in dashboard to activate.')
    print('Press Ctrl+C to stop.')
    print('=' * 60)
    
    try:
        while True:
            current_time = time.time()
            is_enabled = check_telos_enabled()
            stats = get_stats()
            
            # Detect toggle ON
            if is_enabled and not was_enabled:
                print(f'\n[TELOS] 🟢 Mode ENABLED')
                log_activity('telos_on', 'TELOS autonomous mode activated')
                was_enabled = True
                
                # Immediately start generation on toggle ON
                if current_time - last_generation_time > IDEA_GENERATION_COOLDOWN:
                    run_idea_generation()
            
            # Detect toggle OFF
            elif not is_enabled and was_enabled:
                print(f'\n[TELOS] 🔴 Mode DISABLED')
                log_activity('telos_off', 'TELOS autonomous mode deactivated')
                was_enabled = False
            
            # Periodic generation while enabled
            elif is_enabled:
                time_since_last = current_time - last_generation_time
                
                if time_since_last > IDEA_GENERATION_COOLDOWN:
                    run_idea_generation()
                else:
                    remaining = int(IDEA_GENERATION_COOLDOWN - time_since_last)
                    status = f'🟢 ACTIVE | Ideas: {stats["total"]} | Pending: {stats["pending"]} | Next gen: {remaining}s'
                    print(f'\r[TELOS] {status}', end='', flush=True)
            
            # Disabled state
            else:
                print(f'\r[TELOS] 🔴 OFFLINE | Toggle ON in dashboard to start | Ideas: {stats["total"]}', end='', flush=True)
            
            time.sleep(POLL_INTERVAL)
            
    except KeyboardInterrupt:
        print('\n\n[STOPPED] TELOS watcher stopped.')


if __name__ == '__main__':
    main()
