from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

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
    
    # Create unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'{timestamp}.txt'
    filepath = os.path.join(PROMPTS_DIR, filename)
    
    # Save prompt
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(prompt)
    
    print(f'[NEW PROMPT] {filename}: {prompt[:50]}...')
    
    return jsonify({
        'success': True,
        'message': f'Prompt saved as {filename}',
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
    print(f'Prompts saved to: {PROMPTS_DIR}')
    print('=' * 50)
    app.run(host='0.0.0.0', port=3000, debug=True)
