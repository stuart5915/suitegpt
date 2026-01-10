from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Supabase config - same as watcher
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rdsmdywbdiskxknluiym.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), 'prompts')
os.makedirs(PROMPTS_DIR, exist_ok=True)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

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
    return jsonify({
        'status': 'running',
        'pending_prompts': len(os.listdir(PROMPTS_DIR))
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
