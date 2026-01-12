# TELOS Research Module - Perplexity Deep Research Integration
#
# This module performs intelligent market research using Perplexity Deep Research API.
# It builds context-aware prompts based on:
# - Previously generated ideas (avoid duplicates)
# - Rejected ideas with feedback (learn from rejections)
# - User preferences and focus areas
# - Approved ideas (do more like these)

import os
import json
import requests
from datetime import datetime

# ═══ CONFIGURATION ═══
PERPLEXITY_API_KEY = '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'
SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM'


def log_activity(event_type, message):
    """Log activity to ai_activity_log table for dashboard feed."""
    try:
        requests.post(
            f'{SUPABASE_URL}/rest/v1/ai_activity_log',
            headers={
                'apikey': SUPABASE_KEY,
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


def get_existing_ideas():
    """Fetch all existing ideas to avoid duplicates."""
    try:
        response = requests.get(
            f'{SUPABASE_URL}/rest/v1/telos_ideas?select=name,tagline,category,status,rejection_reason',
            headers={'apikey': SUPABASE_KEY},
            timeout=30
        )
        if response.ok:
            return response.json()
    except Exception as e:
        print(f'[RESEARCH] Error fetching existing ideas: {e}')
    return []


def get_telos_config():
    """Fetch TELOS configuration (focus areas, preferences)."""
    try:
        response = requests.get(
            f'{SUPABASE_URL}/rest/v1/telos_config?select=*',
            headers={'apikey': SUPABASE_KEY},
            timeout=10
        )
        if response.ok:
            data = response.json()
            # Convert to dict {key: value}
            return {item['key']: item['value'] for item in data} if data else {}
    except Exception as e:
        print(f'[RESEARCH] Error fetching config: {e}')
    return {}


def build_research_prompt(existing_ideas, config):
    """Build a context-aware research prompt."""
    
    # Categorize existing ideas
    rejected_ideas = [i for i in existing_ideas if i.get('status') == 'rejected']
    approved_ideas = [i for i in existing_ideas if i.get('status') in ['approved', 'building', 'deployed']]
    all_names = [i.get('name', '') for i in existing_ideas]
    all_categories = list(set([i.get('category', '') for i in existing_ideas if i.get('category')]))
    
    # Extract rejection patterns
    rejection_reasons = [i.get('rejection_reason', '') for i in rejected_ideas if i.get('rejection_reason')]
    
    # Build avoidance list
    avoid_list = []
    for idea in existing_ideas[:20]:  # Limit to recent 20 to keep prompt manageable
        avoid_list.append(f"- {idea.get('name', 'Unknown')}: {idea.get('tagline', '')[:50]}")
    
    # Build success patterns
    success_patterns = []
    for idea in approved_ideas[:5]:
        success_patterns.append(f"- {idea.get('name', 'Unknown')} ({idea.get('category', 'Unknown')})")
    
    # Get focus areas from config
    focus_areas = config.get('focus_areas', 'AI tools, productivity, health, finance')
    avoid_categories = config.get('avoid_categories', '')
    monetization_priority = config.get('monetization_priority', 'subscription, in-app purchases, freemium')
    
    prompt = f"""Research emerging mobile app opportunities for 2025-2026 that have strong market potential.

CONTEXT - Apps already in my portfolio (DO NOT suggest similar concepts):
{chr(10).join(avoid_list) if avoid_list else '- None yet (first time generating)'}

PATTERNS FROM REJECTED IDEAS (avoid these patterns):
{chr(10).join([f'- {r}' for r in rejection_reasons[:5]]) if rejection_reasons else '- No rejections yet'}

SUCCESSFUL PATTERNS (do more like these):
{chr(10).join(success_patterns) if success_patterns else '- No approved apps yet'}

FOCUS AREAS: {focus_areas}
AVOID CATEGORIES: {avoid_categories if avoid_categories else 'None specified'}
MONETIZATION PREFERENCE: {monetization_priority}

REQUIREMENTS FOR EACH IDEA:
1. Must be buildable as a React Native/Expo mobile app
2. Must have clear monetization path
3. Must target an underserved niche or emerging trend
4. Must NOT be a generic utility app (todo, notes, calculator, etc.)
5. Should have potential for $1000+/month revenue

Please research and identify 3-5 NOVEL app opportunities with:
- App name and tagline
- Target audience (specific demographic)
- Core problem it solves
- Why NOW is the right time (market timing)
- Monetization strategy
- Key differentiator from existing apps
- Estimated market size or demand signals

Focus on opportunities backed by real data: Reddit discussions, app store gaps, emerging trends, underserved communities."""

    return prompt


def call_perplexity_deep_research(prompt):
    """Call Perplexity Deep Research API."""
    print('[RESEARCH] 🔍 Starting Perplexity Deep Research...')
    log_activity('research_started', 'Starting deep market research with Perplexity AI...')
    
    try:
        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers={
                'Authorization': f'Bearer {PERPLEXITY_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'sonar-deep-research',
                'messages': [
                    {
                        'role': 'system',
                        'content': 'You are a market research analyst specializing in mobile app opportunities. Provide detailed, data-backed research on emerging app opportunities. Always cite sources when possible.'
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                'max_tokens': 4000,
                'temperature': 0.7
            },
            timeout=300  # 5 minutes - deep research takes time
        )
        
        if response.ok:
            result = response.json()
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            citations = result.get('citations', [])
            
            print(f'[RESEARCH] ✅ Research complete! Got {len(content)} chars')
            log_activity('research_complete', f'Deep research complete. Found {len(citations)} sources.')
            
            return {
                'content': content,
                'citations': citations,
                'success': True
            }
        else:
            error = response.text
            print(f'[RESEARCH] ❌ API error: {error}')
            log_activity('research_error', f'Research failed: {error[:100]}')
            return {'success': False, 'error': error}
            
    except Exception as e:
        print(f'[RESEARCH] ❌ Exception: {e}')
        log_activity('research_error', f'Research exception: {str(e)[:100]}')
        return {'success': False, 'error': str(e)}


def parse_ideas_from_research(research_content):
    """Parse the research content into structured app ideas."""
    print('[RESEARCH] 📝 Parsing research into structured ideas...')
    
    # Use a simpler model to parse the research into JSON
    try:
        response = requests.post(
            'https://api.perplexity.ai/chat/completions',
            headers={
                'Authorization': f'Bearer {PERPLEXITY_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'sonar',  # Use regular model for parsing
                'messages': [
                    {
                        'role': 'system',
                        'content': '''You are a JSON parser. Extract app ideas from research and output ONLY valid JSON.
Output format - an array of objects with these exact fields:
{
  "ideas": [
    {
      "name": "App Name",
      "tagline": "Short catchy tagline",
      "description": "2-3 sentence description",
      "category": "Category (Health, Finance, Productivity, AI, Social, etc)",
      "target_audience": "Specific target demographic",
      "problem_solved": "The core problem it solves",
      "why_now": "Why timing is right for this app",
      "monetization": "How it makes money",
      "key_features": ["feature1", "feature2", "feature3"],
      "differentiator": "What makes it unique"
    }
  ]
}'''
                    },
                    {
                        'role': 'user',
                        'content': f'Parse these app ideas into JSON:\n\n{research_content}'
                    }
                ],
                'max_tokens': 3000,
                'temperature': 0.1
            },
            timeout=60
        )
        
        if response.ok:
            result = response.json()
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            # Try to extract JSON from the response
            # Sometimes it's wrapped in markdown code blocks
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]
            
            ideas_data = json.loads(content)
            ideas = ideas_data.get('ideas', [])
            
            print(f'[RESEARCH] ✅ Parsed {len(ideas)} ideas')
            return ideas
            
    except json.JSONDecodeError as e:
        print(f'[RESEARCH] ⚠️ JSON parse error: {e}')
    except Exception as e:
        print(f'[RESEARCH] ⚠️ Parse error: {e}')
    
    return []


def insert_ideas_to_supabase(ideas, research_citations=None):
    """Insert parsed ideas into telos_ideas table."""
    inserted = 0
    
    for idea in ideas:
        try:
            # Map to actual telos_ideas schema
            idea_record = {
                'name': idea.get('name', 'Unnamed App'),
                'tagline': idea.get('tagline', ''),
                'description': idea.get('description', '') + '\n\nWhy Now: ' + idea.get('why_now', '') + '\n\nDifferentiator: ' + idea.get('differentiator', ''),
                'focus_area': idea.get('category', 'Other'),
                'target_audience': idea.get('target_audience', ''),
                'monetization': idea.get('monetization', ''),
                'features': idea.get('key_features', []),
                'status': 'pending',
                'generated_prompt': f"Source: Perplexity Deep Research\nProblem: {idea.get('problem_solved', '')}\nCitations: {research_citations[:3] if research_citations else []}",
                'created_at': datetime.now().isoformat()
            }
            
            response = requests.post(
                f'{SUPABASE_URL}/rest/v1/telos_ideas',
                headers={
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                json=idea_record,
                timeout=30
            )
            
            if response.ok:
                inserted += 1
                print(f'[RESEARCH] ✅ Inserted: {idea.get("name")}')
            else:
                print(f'[RESEARCH] ⚠️ Failed to insert {idea.get("name")}: {response.text}')
                
        except Exception as e:
            print(f'[RESEARCH] ⚠️ Error inserting idea: {e}')
    
    if inserted > 0:
        log_activity('ideas_generated', f'Generated {inserted} new app ideas from deep research')
    
    return inserted


def run_deep_research():
    """Main function to run the full research pipeline."""
    print('\n' + '='*60)
    print('TELOS DEEP RESEARCH - Perplexity Integration')
    print('='*60)
    
    # Step 1: Gather context
    print('\n[STEP 1] Gathering context from existing data...')
    existing_ideas = get_existing_ideas()
    config = get_telos_config()
    print(f'  → Found {len(existing_ideas)} existing ideas')
    print(f'  → Config keys: {list(config.keys())}')
    
    # Step 2: Build smart prompt
    print('\n[STEP 2] Building context-aware research prompt...')
    prompt = build_research_prompt(existing_ideas, config)
    print(f'  → Prompt length: {len(prompt)} chars')
    
    # Step 3: Call Perplexity Deep Research
    print('\n[STEP 3] Calling Perplexity Deep Research API...')
    print('  ⏳ This may take 2-5 minutes...')
    research_result = call_perplexity_deep_research(prompt)
    
    if not research_result.get('success'):
        print(f'\n❌ Research failed: {research_result.get("error")}')
        return False
    
    # Step 4: Parse ideas from research
    print('\n[STEP 4] Parsing ideas from research...')
    ideas = parse_ideas_from_research(research_result['content'])
    
    if not ideas:
        print('\n⚠️ No ideas could be parsed from research')
        return False
    
    # Step 5: Insert ideas to database
    print(f'\n[STEP 5] Inserting {len(ideas)} ideas to database...')
    inserted = insert_ideas_to_supabase(ideas, research_result.get('citations'))
    
    print('\n' + '='*60)
    print(f'✅ RESEARCH COMPLETE: {inserted} new ideas generated!')
    print('='*60 + '\n')
    
    return True


# ═══ CLI ENTRY POINT ═══
if __name__ == '__main__':
    run_deep_research()
