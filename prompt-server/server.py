from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import requests
import subprocess
import threading
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Supabase config - same as watcher
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rdsmdywbdiskxknluiym.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), 'prompts')
os.makedirs(PROMPTS_DIR, exist_ok=True)

# Auto-pull state
auto_pull_enabled = False
auto_push_enabled = False
last_completed_id = None
pull_count = 0  # Track how many auto-pulls have happened

# Push tracking - watcher.py writes to this file when it pushes
PUSH_STATUS_FILE = os.path.join(os.path.dirname(__file__), '.last_push')

def get_last_push_time():
    """Read last push timestamp from file (written by watcher.py)"""
    try:
        if os.path.exists(PUSH_STATUS_FILE):
            with open(PUSH_STATUS_FILE, 'r') as f:
                return f.read().strip()
    except:
        pass
    return None

def auto_pull_worker():
    """Background thread that checks git remote for new commits and auto-pulls"""
    global pull_count
    
    while True:
        if auto_pull_enabled:
            try:
                repo_dir = os.path.dirname(os.path.dirname(__file__))
                
                # Fetch latest from remote (doesn't change working copy)
                subprocess.run(['git', 'fetch'], cwd=repo_dir, capture_output=True)
                
                # Check if there are new commits on origin/master
                result = subprocess.run(
                    ['git', 'rev-list', 'HEAD..origin/master', '--count'],
                    cwd=repo_dir, capture_output=True, text=True
                )
                
                new_commits = int(result.stdout.strip() or '0')
                
                if new_commits > 0:
                    print(f'[AUTO-PULL] {new_commits} new commit(s) detected, pulling...')
                    pull_result = subprocess.run(
                        ['git', 'pull'],
                        cwd=repo_dir,
                        capture_output=True, text=True
                    )
                    pull_count += 1
                    print(f'[AUTO-PULL #{pull_count}] {pull_result.stdout.strip()}')
            except Exception as e:
                print(f'[AUTO-PULL] Error: {e}')
        time.sleep(5)  # Check every 5 seconds

# Start background thread
threading.Thread(target=auto_pull_worker, daemon=True).start()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/screenshots/<filename>')
def serve_screenshot(filename):
    """Serve screenshot images"""
    screenshots_dir = os.path.join(os.path.dirname(__file__), 'screenshots')
    return send_from_directory(screenshots_dir, filename)

# Images upload directory
IMAGES_DIR = os.path.join(os.path.dirname(__file__), 'images')
os.makedirs(IMAGES_DIR, exist_ok=True)

@app.route('/images/<filename>')
def serve_image(filename):
    """Serve uploaded images"""
    return send_from_directory(IMAGES_DIR, filename)

@app.route('/upload-image', methods=['POST'])
def upload_image():
    """Upload an image to attach to prompts"""
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image provided'})
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'})
    
    # Save with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    ext = os.path.splitext(file.filename)[1] or '.png'
    filename = f'{timestamp}{ext}'
    filepath = os.path.join(IMAGES_DIR, filename)
    file.save(filepath)
    
    # Return path that works on PC (they share the repo)
    relative_path = f'prompt-server/images/{filename}'
    return jsonify({'success': True, 'path': relative_path, 'filename': filename})

@app.route('/send', methods=['POST'])
def send_prompt():
    data = request.json
    prompt = data.get('prompt', '').strip()
    
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    
    # Save to local file (backup)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'{timestamp}.txt'
    filepath = os.path.join(PROMPTS_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(prompt)
    
    # INSERT into Supabase (main path - watcher polls this)
    if SUPABASE_KEY:
        try:
            response = requests.post(
                f'{SUPABASE_URL}/rest/v1/prompts',
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                json={
                    'prompt': prompt,
                    'target': 'stuart-hollinger-landing',
                    'status': 'pending'
                }
            )
            if response.ok:
                print(f'[NEW PROMPT] {filename}: {prompt[:50]}... -> Supabase ✓')
            else:
                print(f'[WARNING] Supabase insert failed: {response.text}')
        except Exception as e:
            print(f'[WARNING] Supabase error: {e}')
    else:
        print(f'[NEW PROMPT] {filename}: {prompt[:50]}... (local only - no SUPABASE_KEY)')
    
    return jsonify({
        'success': True,
        'message': f'Prompt queued! Watcher will process it.',
        'filename': filename
    })

@app.route('/prompts', methods=['GET'])
def list_prompts():
    files = sorted(os.listdir(PROMPTS_DIR), reverse=True)
    return jsonify({'prompts': files})

@app.route('/status', methods=['GET'])
def status():
    last_push = get_last_push_time()
    return jsonify({
        'status': 'running',
        'pending_prompts': len(os.listdir(PROMPTS_DIR)),
        'auto_pull': auto_pull_enabled,
        'auto_push': auto_push_enabled,
        'pull_count': pull_count,
        'last_push': last_push
    })

@app.route('/needs-review', methods=['GET'])
def needs_review():
    """Get prompts that need attention (AI asked questions instead of making changes)"""
    if not SUPABASE_KEY:
        return jsonify({'prompts': [], 'error': 'No Supabase key'})
    
    try:
        response = requests.get(
            f'{SUPABASE_URL}/rest/v1/prompts?status=eq.needs-review&order=updated_at.desc&limit=5',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}'
            }
        )
        if response.ok:
            return jsonify({'prompts': response.json()})
        else:
            return jsonify({'prompts': [], 'error': response.text})
    except Exception as e:
        return jsonify({'prompts': [], 'error': str(e)})

@app.route('/dismiss-prompt', methods=['POST'])
def dismiss_prompt():
    """Mark a needs-review prompt as dismissed"""
    if not SUPABASE_KEY:
        return jsonify({'success': False, 'error': 'No Supabase key'})
    
    data = request.json
    prompt_id = data.get('id')
    if not prompt_id:
        return jsonify({'success': False, 'error': 'No prompt ID'})
    
    try:
        response = requests.patch(
            f'{SUPABASE_URL}/rest/v1/prompts?id=eq.{prompt_id}',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            },
            json={'status': 'dismissed'}
        )
        return jsonify({'success': response.ok})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/respond', methods=['POST'])
def respond_to_prompt():
    """Send a response to a needs-review prompt"""
    if not SUPABASE_KEY:
        return jsonify({'success': False, 'error': 'No Supabase key'})
    
    data = request.json
    prompt_id = data.get('id')
    response_text = data.get('response', '').strip()
    
    if not prompt_id or not response_text:
        return jsonify({'success': False, 'error': 'Missing prompt ID or response'})
    
    try:
        # Update prompt with response and set status to 'responding'
        # Watcher will pick this up and type it into the correct window
        response = requests.patch(
            f'{SUPABASE_URL}/rest/v1/prompts?id=eq.{prompt_id}',
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'response': response_text,
                'status': 'responding'
            }
        )
        return jsonify({'success': response.ok})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/pull', methods=['POST'])
def git_pull():
    """Manual git pull"""
    try:
        result = subprocess.run(
            ['git', 'pull'],
            cwd=os.path.dirname(os.path.dirname(__file__)),
            capture_output=True, text=True
        )
        return jsonify({
            'success': True,
            'output': result.stdout.strip() or result.stderr.strip()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/auto-pull', methods=['POST'])
def toggle_auto_pull():
    """Toggle auto-pull on/off"""
    global auto_pull_enabled
    auto_pull_enabled = not auto_pull_enabled
    status = 'ON' if auto_pull_enabled else 'OFF'
    print(f'[AUTO-PULL] Toggled {status}')
    return jsonify({
        'success': True,
        'auto_pull': auto_pull_enabled,
        'message': f'Auto-pull is now {status}'
    })

# Auto-push worker thread
def auto_push_worker():
    """Background thread that auto-pushes local changes every 30 seconds"""
    while True:
        if auto_push_enabled:
            try:
                repo_dir = os.path.dirname(os.path.dirname(__file__))
                # Check if there are changes to push
                status = subprocess.run(
                    ['git', 'status', '--porcelain'],
                    cwd=repo_dir, capture_output=True, text=True
                )
                if status.stdout.strip():
                    # There are changes - commit and push
                    subprocess.run(['git', 'add', '-A'], cwd=repo_dir)
                    subprocess.run(
                        ['git', 'commit', '-m', 'Auto-commit from laptop'],
                        cwd=repo_dir, capture_output=True
                    )
                    result = subprocess.run(
                        ['git', 'push'],
                        cwd=repo_dir, capture_output=True, text=True
                    )
                    if result.returncode == 0:
                        print(f'[AUTO-PUSH] Pushed changes to GitHub')
            except Exception as e:
                print(f'[AUTO-PUSH] Error: {e}')
        time.sleep(30)

# Start auto-push thread
threading.Thread(target=auto_push_worker, daemon=True).start()

@app.route('/push', methods=['POST'])
def git_push():
    """Manual git push"""
    try:
        repo_dir = os.path.dirname(os.path.dirname(__file__))
        # Add all changes
        subprocess.run(['git', 'add', '-A'], cwd=repo_dir)
        # Commit
        commit_result = subprocess.run(
            ['git', 'commit', '-m', 'Manual push from laptop'],
            cwd=repo_dir, capture_output=True, text=True
        )
        # Push
        result = subprocess.run(
            ['git', 'push'],
            cwd=repo_dir, capture_output=True, text=True
        )
        output = result.stdout.strip() or result.stderr.strip() or 'Already up to date'
        if 'nothing to commit' in commit_result.stdout:
            output = 'Nothing to push - no changes'
        return jsonify({
            'success': True,
            'output': output
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/auto-push', methods=['POST'])
def toggle_auto_push():
    """Toggle auto-push on/off"""
    global auto_push_enabled
    auto_push_enabled = not auto_push_enabled
    status = 'ON' if auto_push_enabled else 'OFF'
    print(f'[AUTO-PUSH] Toggled {status}')
    return jsonify({
        'success': True,
        'auto_push': auto_push_enabled,
        'message': f'Auto-push is now {status}'
    })

if __name__ == '__main__':
    print('=' * 50)
    print('PROMPT SERVER RUNNING')
    print('=' * 50)
    print(f'Open http://10.0.0.142:3000 on your laptop')
    if SUPABASE_KEY:
        print(f'Supabase: Connected ✓')
    else:
        print(f'Supabase: NOT CONNECTED (set SUPABASE_SERVICE_KEY)')
    print('=' * 50)
    app.run(host='0.0.0.0', port=3000, debug=True)

