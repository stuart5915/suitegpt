"""
TELOS Intelligent Batch Ideation System
========================================
Generates 5 diverse app ideas using market research, historical context,
rejection learning, and seasonal awareness. Fully dynamic - learns from
your preferences over time.

Uses Antigravity (local AI) for everything.
"""

import os
import json
import uuid
import requests
from datetime import datetime, timedelta

# ═══ CONFIGURATION ═══
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rdsmdywbdiskxknluiym.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# Limits
MAX_BATCHES_PER_DAY = 3  # Generate up to 3 batches of 5 ideas per day
IDEAS_PER_BATCH = 5
COOLDOWN_HOURS = 2


# ═══════════════════════════════════════════════════════════════════
# ACTIVITY LOGGING
# ═══════════════════════════════════════════════════════════════════

def log_activity(action_type: str, message: str, app_name: str = None, metadata: dict = None):
    """
    Log activity to ai_activity_log table for live dashboard feed.
    
    action_type: 'autonomous_on', 'autonomous_off', 'research', 'ideas_generated',
                 'idea_approved', 'build_start', 'build_progress', 'build_complete',
                 'error', 'iteration'
    """
    if not SUPABASE_KEY:
        return
    
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/ai_activity_log",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'action_type': action_type,
                'message': message,
                'app_name': app_name,
                'metadata': json.dumps(metadata) if metadata else '{}'
            },
            timeout=5
        )
    except Exception:
        pass  # Don't break main flow if logging fails


# ═══════════════════════════════════════════════════════════════════
# HISTORICAL CONTEXT FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def get_recent_ideas(days: int = 30) -> list:
    """Fetch ideas generated in the last N days to avoid repetition."""
    if not SUPABASE_KEY:
        return []
    
    try:
        cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/telos_ideas?created_at=gte.{cutoff}T00:00:00&select=name,tagline,description,status",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"[TELOS] Error fetching recent ideas: {e}")
        return []


def get_rejection_patterns() -> list:
    """Get rejected ideas with reasons to learn from mistakes."""
    if not SUPABASE_KEY:
        return []
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/telos_ideas?status=eq.rejected&select=name,tagline,rejection_reason&order=created_at.desc&limit=20",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"[TELOS] Error fetching rejections: {e}")
        return []


def get_success_patterns() -> list:
    """Get approved/deployed ideas to learn preferences."""
    if not SUPABASE_KEY:
        return []
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/telos_ideas?status=in.(approved,building,deployed)&select=name,tagline,description&order=created_at.desc&limit=10",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"[TELOS] Error fetching successes: {e}")
        return []


def get_existing_apps() -> list:
    """Fetch existing SUITE apps to avoid duplicates."""
    if not SUPABASE_KEY:
        return []
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/suite_apps?select=name,description,summary",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"[TELOS] Error fetching existing apps: {e}")
        return []


def get_seasonal_context() -> dict:
    """Get current date/season context for timely ideas."""
    now = datetime.now()
    month = now.strftime('%B')
    year = now.year
    day = now.day
    
    # Determine season (Northern Hemisphere)
    month_num = now.month
    if month_num in [12, 1, 2]:
        season = "Winter"
    elif month_num in [3, 4, 5]:
        season = "Spring"
    elif month_num in [6, 7, 8]:
        season = "Summer"
    else:
        season = "Fall"
    
    # Upcoming events/holidays
    upcoming = []
    if month_num == 1:
        upcoming = ["New Year's resolutions peak", "Winter fitness motivation"]
    elif month_num == 2:
        upcoming = ["Valentine's Day (Feb 14)", "Heart health awareness"]
    elif month_num == 3:
        upcoming = ["Spring cleaning", "Lent/Easter prep"]
    elif month_num == 4:
        upcoming = ["Easter", "Tax season", "Spring gardening"]
    elif month_num == 5:
        upcoming = ["Mother's Day", "Memorial Day", "Graduation season"]
    elif month_num == 6:
        upcoming = ["Father's Day", "Summer vacation planning"]
    elif month_num == 7:
        upcoming = ["Independence Day", "Summer travel peak"]
    elif month_num == 8:
        upcoming = ["Back to school prep", "End of summer"]
    elif month_num == 9:
        upcoming = ["Labor Day", "Fall routines", "School year start"]
    elif month_num == 10:
        upcoming = ["Halloween", "Fall activities", "Flu season prep"]
    elif month_num == 11:
        upcoming = ["Thanksgiving", "Black Friday", "Holiday prep"]
    elif month_num == 12:
        upcoming = ["Christmas", "New Year's Eve", "Year in review"]
    
    return {
        'date': f"{month} {day}, {year}",
        'season': season,
        'upcoming': upcoming,
        'month': month,
        'year': year
    }


# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION & LIMITS
# ═══════════════════════════════════════════════════════════════════

def get_telos_config() -> dict:
    """Get TELOS configuration from Supabase."""
    if not SUPABASE_KEY:
        return {'enabled': False}
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/ai_config?key=eq.telos_mode&select=*",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data:
                config = data[0].get('value', {})
                if isinstance(config, str):
                    config = json.loads(config)
                return config
        return {'enabled': False}
    except Exception as e:
        print(f"[TELOS] Error fetching config: {e}")
        return {'enabled': False}


def is_enabled() -> bool:
    """Check if TELOS mode is enabled."""
    env_enabled = os.environ.get('TELOS_ENABLED', '').lower()
    if env_enabled in ('true', '1'):
        return True
    if env_enabled in ('false', '0'):
        return False
    
    config = get_telos_config()
    return config.get('enabled', False)


def get_daily_batch_count() -> int:
    """Get count of batches generated today."""
    if not SUPABASE_KEY:
        return 0
    
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/telos_ideas?created_at=gte.{today}T00:00:00&select=batch_id",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if response.status_code == 200:
            ideas = response.json()
            # Count unique batch_ids
            batch_ids = set(i.get('batch_id') for i in ideas if i.get('batch_id'))
            return len(batch_ids)
        return 0
    except:
        return 0


def get_last_batch_time() -> datetime:
    """Get timestamp of last batch generation."""
    if not SUPABASE_KEY:
        return datetime.min
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/telos_ideas?order=created_at.desc&limit=1&select=created_at",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data:
                timestamp = data[0].get('created_at', '')
                return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return datetime.min
    except:
        return datetime.min


def check_limits() -> tuple:
    """Check if under limits. Returns (can_proceed, reason)."""
    daily_count = get_daily_batch_count()
    if daily_count >= MAX_BATCHES_PER_DAY:
        return False, f"Daily limit ({daily_count}/{MAX_BATCHES_PER_DAY} batches)"
    
    last_time = get_last_batch_time()
    if last_time != datetime.min:
        now = datetime.utcnow()
        if hasattr(last_time, 'tzinfo') and last_time.tzinfo:
            last_time = last_time.replace(tzinfo=None)
        
        time_since = now - last_time
        if time_since < timedelta(hours=COOLDOWN_HOURS):
            remaining = timedelta(hours=COOLDOWN_HOURS) - time_since
            mins = remaining.seconds // 60
            return False, f"Cooldown ({mins}min left)"
    
    return True, "Ready"


# ═══════════════════════════════════════════════════════════════════
# INTELLIGENT PROMPT GENERATION
# ═══════════════════════════════════════════════════════════════════

def generate_intelligent_batch_prompt(direction: str = None) -> tuple:
    """
    Generate the intelligent batch ideation prompt.
    Includes historical context, rejection learning, success patterns, and seasonal awareness.
    
    Args:
        direction: Optional user-specified direction (e.g., "focus on AI tools")
    
    Returns:
        (prompt_text, batch_id)
    """
    batch_id = str(uuid.uuid4())
    
    # Gather all context
    recent_ideas = get_recent_ideas(30)
    rejections = get_rejection_patterns()
    successes = get_success_patterns()
    existing_apps = get_existing_apps()
    seasonal = get_seasonal_context()
    
    # Format recent ideas (to avoid)
    recent_text = "None yet"
    if recent_ideas:
        recent_list = [f"- {i.get('name', 'Unknown')}: {i.get('tagline', '')}" for i in recent_ideas[:15]]
        recent_text = "\n".join(recent_list)
    
    # Format rejections (learn from)
    rejection_text = "None yet - this is a fresh start!"
    if rejections:
        rejection_list = [f"- {r.get('name', 'Unknown')}: {r.get('rejection_reason', 'No reason')}" for r in rejections[:10]]
        rejection_text = "\n".join(rejection_list)
    
    # Format successes (do more like)
    success_text = "None yet - be creative!"
    if successes:
        success_list = [f"- {s.get('name', 'Unknown')}: {s.get('tagline', '')}" for s in successes[:5]]
        success_text = "\n".join(success_list)
    
    # Format existing apps (don't duplicate)
    existing_text = "None yet"
    if existing_apps:
        existing_list = [app.get('name', '') for app in existing_apps[:15]]
        existing_text = ", ".join(existing_list)
    
    # Format seasonal context
    seasonal_text = f"""Date: {seasonal['date']}
Season: {seasonal['season']}
Upcoming: {', '.join(seasonal['upcoming'])}"""
    
    # Direction override
    direction_text = ""
    if direction:
        direction_text = f"""
═══ USER DIRECTION ═══
The user has requested: {direction}
Prioritize this direction while still ensuring diversity.
"""
    
    # Build the mega-prompt
    json_output_path = "prompt-server/telos_ideas_batch.json"
    
    prompt = f"""[TELOS MODE - INTELLIGENT BATCH IDEATION]

You are generating {IDEAS_PER_BATCH} diverse app ideas for the SUITE ecosystem.
This batch ID: {batch_id}

═══ HISTORICAL CONTEXT (Avoid These) ═══
Recently generated ideas (last 30 days):
{recent_text}

═══ REJECTION PATTERNS (Learn From These) ═══
These were rejected - don't repeat similar concepts:
{rejection_text}

═══ SUCCESS PATTERNS (Do More Like These) ═══
These were approved - understand what works:
{success_text}

═══ EXISTING SUITE APPS (Don't Duplicate) ═══
{existing_text}

═══ CURRENT CONTEXT ═══
{seasonal_text}
{direction_text}

═══ REQUIREMENTS ═══
1. Generate {IDEAS_PER_BATCH} DIVERSE app ideas
2. Each must be buildable in ~50 iterations
3. All must align with Christian values
4. Each should serve different use cases
5. Consider the seasonal context - timely ideas perform better
6. React Native / Expo compatible

═══ OUTPUT ═══
Create the file: {json_output_path}
Write a JSON array with {IDEAS_PER_BATCH} ideas:

[
  {{
    "name": "AppName1",
    "tagline": "Short catchy description",
    "description": "2-3 sentences about what it does and why it's valuable",
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "target_audience": "Who this is for",
    "monetization": "How it makes money",
    "why_now": "Why this idea is timely/relevant",
    "batch_id": "{batch_id}"
  }},
  ... 4 more ideas ...
]

IMPORTANT: 
- Write to {json_output_path} - do NOT just respond with text
- Make each idea genuinely different (different categories, audiences, purposes)
- The watcher will read this file and queue all 5 for owner approval"""

    return prompt, batch_id


# ═══════════════════════════════════════════════════════════════════
# IDEA INSERTION
# ═══════════════════════════════════════════════════════════════════

def insert_batch_ideas(ideas: list, batch_id: str) -> int:
    """Insert a batch of ideas into telos_ideas table. Returns count inserted."""
    if not SUPABASE_KEY:
        return 0
    
    inserted = 0
    for idea in ideas:
        try:
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/telos_ideas",
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                json={
                    'name': idea.get('name', 'Unnamed App'),
                    'tagline': idea.get('tagline', ''),
                    'description': idea.get('description', ''),
                    'features': json.dumps(idea.get('features', [])),
                    'target_audience': idea.get('target_audience', ''),
                    'monetization': idea.get('monetization', ''),
                    'why_now': idea.get('why_now', ''),
                    'batch_id': batch_id,
                    'status': 'pending',
                    'generated_prompt': generate_build_prompt(idea)
                },
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                inserted += 1
                print(f"[TELOS] ✅ Queued: {idea.get('name')}")
            else:
                print(f"[TELOS] ⚠️ Failed to insert {idea.get('name')}: {response.status_code}")
        except Exception as e:
            print(f"[TELOS] ⚠️ Insert exception for {idea.get('name', '?')}: {e}")
    
    # Log successful insertion
    if inserted > 0:
        log_activity(
            'ideas_generated',
            f'Generated {inserted} new app ideas ready for review',
            metadata={'batch_id': batch_id, 'count': inserted}
        )
    
    return inserted


def insert_pending_idea(idea_data: dict, focus_area: str = "General") -> bool:
    """Insert a single parsed idea into telos_ideas table for approval."""
    if not SUPABASE_KEY:
        return False
    
    batch_id = idea_data.get('batch_id', str(uuid.uuid4()))
    
    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/telos_ideas",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            json={
                'name': idea_data.get('name', 'Unnamed App'),
                'tagline': idea_data.get('tagline', ''),
                'description': idea_data.get('description', ''),
                'features': json.dumps(idea_data.get('features', [])),
                'target_audience': idea_data.get('target_audience', ''),
                'monetization': idea_data.get('monetization', ''),
                'why_now': idea_data.get('why_now', ''),
                'batch_id': batch_id,
                'status': 'pending',
                'generated_prompt': generate_build_prompt(idea_data)
            },
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            print(f"[TELOS] ✅ Idea queued for approval: {idea_data.get('name')}")
            return True
        else:
            print(f"[TELOS] Idea insert failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[TELOS] Idea insert exception: {e}")
        return False


def generate_build_prompt(idea_data: dict) -> str:
    """Generate the prompt that will build the app once approved."""
    name = idea_data.get('name', 'MyApp')
    slug = name.lower().replace(' ', '-').replace("'", "").replace(" ", "-")
    
    features = idea_data.get('features', [])
    if isinstance(features, str):
        features = json.loads(features)
    features_text = '\n'.join([f"- {f}" for f in features])
    
    return f"""Create a React Native Expo app called "{name}".

{idea_data.get('description', '')}

Key Features:
{features_text}

Target Audience: {idea_data.get('target_audience', 'General users')}

Requirements:
- Use Expo SDK and React Native
- Clean, modern UI with smooth animations
- Functional offline-first design
- Include splash screen and app icon
- Make it fully working, not a placeholder

Start by running: npx create-expo-app {slug} --template blank
Then build out all the screens and functionality."""


# ═══════════════════════════════════════════════════════════════════
# PROMPT INSERTION
# ═══════════════════════════════════════════════════════════════════

def insert_batch_generation_prompt(direction: str = None) -> tuple:
    """
    Insert a batch ideation prompt into the prompts table.
    Returns (prompt_id, batch_id) or (None, None) on failure.
    """
    if not SUPABASE_KEY:
        return None, None
    
    prompt_text, batch_id = generate_intelligent_batch_prompt(direction)
    
    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/prompts",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            json={
                'prompt': prompt_text,
                'status': 'pending',
                'prompt_type': 'telos_batch',
                'source': 'TELOS Mode (Intelligent)',
                'metadata': json.dumps({
                    'batch_id': batch_id,
                    'stage': 'batch_ideation',
                    'direction': direction
                })
            },
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            prompt_id = data[0]['id'] if isinstance(data, list) else data['id']
            print(f"[TELOS] ✨ Batch ideation prompt inserted: {prompt_id}")
            print(f"[TELOS] 📦 Batch ID: {batch_id}")
            return prompt_id, batch_id
        else:
            print(f"[TELOS] Insert failed: {response.status_code}")
            return None, None
    except Exception as e:
        print(f"[TELOS] Insert exception: {e}")
        return None, None


# ═══════════════════════════════════════════════════════════════════
# MAIN CYCLE
# ═══════════════════════════════════════════════════════════════════

def run_telos_cycle(direction: str = None) -> bool:
    """
    Main TELOS cycle - generates intelligent batch ideation prompt.
    
    Args:
        direction: Optional user direction (e.g., "focus on fitness apps")
    
    Returns:
        True if prompt was inserted, False otherwise.
    """
    if not is_enabled():
        return False
    
    can_run, reason = check_limits()
    if not can_run:
        print(f"[TELOS] Limited: {reason}")
        return False
    
    # Insert the batch generation prompt
    prompt_id, batch_id = insert_batch_generation_prompt(direction)
    
    if prompt_id:
        print(f"[TELOS] 🚀 Batch ideation started!")
        print(f"[TELOS] 📊 Will generate {IDEAS_PER_BATCH} diverse ideas")
        
        # Log to activity feed
        log_activity(
            'research', 
            f'Starting market research for {IDEAS_PER_BATCH} new app ideas',
            metadata={'batch_id': batch_id, 'direction': direction}
        )
        return True
    
    return False


# ═══════════════════════════════════════════════════════════════════
# TEST
# ═══════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("=" * 60)
    print("TELOS INTELLIGENT BATCH IDEATION TEST")
    print("=" * 60)
    
    print(f"\nEnabled: {is_enabled()}")
    print(f"Batches today: {get_daily_batch_count()}")
    
    can_proceed, reason = check_limits()
    print(f"Can proceed: {can_proceed} ({reason})")
    
    print("\n--- Seasonal Context ---")
    seasonal = get_seasonal_context()
    print(f"Date: {seasonal['date']}")
    print(f"Season: {seasonal['season']}")
    print(f"Upcoming: {', '.join(seasonal['upcoming'])}")
    
    print("\n--- Sample Prompt Preview ---")
    prompt, batch_id = generate_intelligent_batch_prompt()
    print(f"Batch ID: {batch_id}")
    print(f"Prompt length: {len(prompt)} chars")
    print(f"\nFirst 1000 chars:\n{prompt[:1000]}...")
