"""
Inclawbator Compute Node
========================
One Docker image. Two income streams.

1. Inclawbate jobs → earn CLAWS (priority)
2. External compute markets → earn USD (when idle)

Non-custodial: USD goes to your own accounts, CLAWS claimed via smart contract.
"""

import os
import sys
import json
import time
import signal
import threading
import subprocess
import requests
from datetime import datetime

# ═══════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════

WALLET = os.environ.get('WALLET', '')
INCLAWBATE_API = os.environ.get('INCLAWBATE_API', 'https://www.inclawbate.app')
HEARTBEAT_INTERVAL = int(os.environ.get('HEARTBEAT_INTERVAL', '30'))  # seconds
NODE_VERSION = '0.1.0'

# External market credentials (optional — node earns CLAWS-only if not set)
SALAD_TOKEN = os.environ.get('SALAD_TOKEN', '')        # salad.com API token
VASTAI_KEY = os.environ.get('VASTAI_API_KEY', '')       # vast.ai API key
IONET_KEY = os.environ.get('IONET_DEVICE_ID', '')       # io.net device ID

# ═══════════════════════════════════════
# GPU DETECTION
# ═══════════════════════════════════════

def detect_gpu():
    """Detect NVIDIA GPU name and VRAM."""
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(',')
            name = parts[0].strip()
            vram_mb = int(parts[1].strip())
            vram_gb = round(vram_mb / 1024)
            return {'name': name, 'vram_gb': vram_gb}
    except Exception as e:
        print(f'[GPU] Detection failed: {e}')
    return {'name': 'Unknown GPU', 'vram_gb': 0}


def get_gpu_utilization():
    """Get current GPU utilization %."""
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return int(result.stdout.strip())
    except:
        pass
    return 0

# ═══════════════════════════════════════
# INCLAWBATE CONNECTION
# ═══════════════════════════════════════

class InclawbateClient:
    """Handles registration, heartbeats, and job polling with the Inclawbate platform."""

    def __init__(self, api_url, wallet, gpu_info):
        self.api = api_url
        self.wallet = wallet
        self.gpu = gpu_info
        self.jobs_completed = 0
        self.current_task = None
        self.registered = False

    def register(self):
        """Register this node with the Inclawbate compute network."""
        try:
            r = requests.post(f'{self.api}/api/inclawbate/compute/register', json={
                'wallet': self.wallet,
                'gpu_name': self.gpu['name'],
                'gpu_vram_gb': self.gpu['vram_gb'],
                'os': sys.platform,
                'node_version': NODE_VERSION
            }, timeout=10)
            data = r.json()
            if data.get('ok'):
                self.registered = True
                print(f'[INCLAWBATE] Registered: {self.gpu["name"]} ({self.gpu["vram_gb"]}GB)')
                return True
            else:
                print(f'[INCLAWBATE] Registration failed: {data.get("error")}')
        except Exception as e:
            print(f'[INCLAWBATE] Registration error: {e}')
        return False

    def heartbeat(self):
        """Send heartbeat to earn compute units."""
        try:
            r = requests.post(f'{self.api}/api/inclawbate/compute/heartbeat', json={
                'wallet': self.wallet,
                'gpu_utilization': get_gpu_utilization(),
                'jobs_completed': self.jobs_completed,
                'current_task': self.current_task
            }, timeout=10)
            data = r.json()
            if data.get('ok'):
                return data
            else:
                print(f'[HEARTBEAT] Error: {data.get("error")}')
        except Exception as e:
            print(f'[HEARTBEAT] Failed: {e}')
        return None

    def poll_job(self):
        """Check for available Inclawbate jobs. Returns job dict or None."""
        # TODO: implement job polling endpoint on platform side
        # For now, returns None (no jobs available)
        return None

    def complete_job(self, job_id, result):
        """Report job completion to platform."""
        # TODO: implement job completion endpoint
        self.jobs_completed += 1
        self.current_task = None

# ═══════════════════════════════════════
# EXTERNAL MARKET WORKERS
# ═══════════════════════════════════════

class ExternalWorkerManager:
    """Manages connections to external GPU markets (Salad, Vast.ai, io.net)."""

    def __init__(self):
        self.salad_running = False
        self.vastai_running = False
        self.ionet_running = False
        self.processes = []

    def start_salad(self):
        """Start Salad worker if token is configured."""
        if not SALAD_TOKEN:
            return
        print('[SALAD] Starting Salad worker...')
        print(f'[SALAD] Token: {SALAD_TOKEN[:8]}...')
        # Salad worker integration:
        # Option 1: Salad CLI (if installed in Docker image)
        # Option 2: Salad Container Engine API
        # For now, log that it would start
        try:
            # Check if salad CLI exists
            result = subprocess.run(['which', 'salad'], capture_output=True, text=True)
            if result.returncode == 0:
                proc = subprocess.Popen(
                    ['salad', 'start', '--token', SALAD_TOKEN],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                self.processes.append(proc)
                self.salad_running = True
                print('[SALAD] Worker started — earning USD to your Salad account')
            else:
                print('[SALAD] CLI not found. Install Salad to earn USD when idle.')
                print('[SALAD] Visit: https://salad.com/download')
                self.salad_running = False
        except Exception as e:
            print(f'[SALAD] Start failed: {e}')

    def start_vastai(self):
        """Start Vast.ai host if API key is configured."""
        if not VASTAI_KEY:
            return
        print('[VAST.AI] Starting Vast.ai host...')
        print(f'[VAST.AI] API Key: {VASTAI_KEY[:8]}...')
        try:
            result = subprocess.run(['which', 'vastai'], capture_output=True, text=True)
            if result.returncode == 0:
                # List this machine on Vast.ai marketplace
                proc = subprocess.Popen(
                    ['vastai', 'start', 'host', '--api-key', VASTAI_KEY],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                self.processes.append(proc)
                self.vastai_running = True
                print('[VAST.AI] Host started — your GPU is listed on Vast.ai marketplace')
            else:
                print('[VAST.AI] CLI not found. Install vastai CLI to earn USD when idle.')
                print('[VAST.AI] pip install vastai')
                self.vastai_running = False
        except Exception as e:
            print(f'[VAST.AI] Start failed: {e}')

    def start_ionet(self):
        """Start io.net worker if device ID is configured."""
        if not IONET_KEY:
            return
        print('[IO.NET] Starting io.net worker...')
        print(f'[IO.NET] Device: {IONET_KEY[:8]}...')
        try:
            result = subprocess.run(['which', 'ionet'], capture_output=True, text=True)
            if result.returncode == 0:
                proc = subprocess.Popen(
                    ['ionet', 'worker', 'start', '--device-id', IONET_KEY],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                self.processes.append(proc)
                self.ionet_running = True
                print('[IO.NET] Worker started — earning IO tokens')
            else:
                print('[IO.NET] CLI not found. Visit https://io.net to set up.')
                self.ionet_running = False
        except Exception as e:
            print(f'[IO.NET] Start failed: {e}')

    def pause_all(self):
        """Pause external workers when an Inclawbate job needs the GPU."""
        for proc in self.processes:
            try:
                proc.send_signal(signal.SIGSTOP)
            except:
                pass

    def resume_all(self):
        """Resume external workers after Inclawbate job completes."""
        for proc in self.processes:
            try:
                proc.send_signal(signal.SIGCONT)
            except:
                pass

    def stop_all(self):
        """Stop all external workers on shutdown."""
        for proc in self.processes:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except:
                pass

    def start_all(self):
        """Start all configured external market workers."""
        self.start_salad()
        self.start_vastai()
        self.start_ionet()
        active = sum([self.salad_running, self.vastai_running, self.ionet_running])
        print(f'[EXTERNAL] {active} market worker(s) running')

# ═══════════════════════════════════════
# LOCAL DASHBOARD (localhost:3000)
# ═══════════════════════════════════════

def start_dashboard(client, external, gpu_info):
    """Simple local web dashboard showing node status."""
    from flask import Flask, jsonify, render_template_string

    app = Flask(__name__)

    DASHBOARD_HTML = """
    <!DOCTYPE html>
    <html><head><title>Inclawbator Node</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; background: #0a0a0f; color: #f0f0f5; padding: 32px; }
        h1 { font-size: 1.4rem; margin-bottom: 4px; }
        h1 span { color: #c0534d; }
        .sub { color: #606070; font-size: 0.85rem; margin-bottom: 24px; }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 12px; }
        .stat { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.88rem; }
        .stat-label { color: #606070; }
        .stat-value { font-weight: 700; }
        .green { color: #4ade80; }
        .lobster { color: #c0534d; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 700; }
        .badge-on { background: rgba(74,222,128,0.1); color: #4ade80; }
        .badge-off { background: rgba(96,96,112,0.2); color: #606070; }
    </style>
    <script>setTimeout(()=>location.reload(), 10000);</script>
    </head><body>
    <h1><span>Inclawbator</span> Node</h1>
    <p class="sub">v{{ version }} &mdash; auto-refreshes every 10s</p>
    <div class="card">
        <div class="stat"><span class="stat-label">GPU</span><span class="stat-value">{{ gpu_name }}</span></div>
        <div class="stat"><span class="stat-label">VRAM</span><span class="stat-value">{{ gpu_vram }}GB</span></div>
        <div class="stat"><span class="stat-label">Wallet</span><span class="stat-value">{{ wallet_short }}</span></div>
        <div class="stat"><span class="stat-label">Status</span><span class="stat-value green">Online</span></div>
    </div>
    <div class="card">
        <div class="stat"><span class="stat-label">Compute Units</span><span class="stat-value lobster">{{ compute_units }}</span></div>
        <div class="stat"><span class="stat-label">Unclaimed Units</span><span class="stat-value lobster">{{ unclaimed }}</span></div>
        <div class="stat"><span class="stat-label">Jobs Completed</span><span class="stat-value">{{ jobs }}</span></div>
        <div class="stat"><span class="stat-label">Current Task</span><span class="stat-value">{{ current_task }}</span></div>
    </div>
    <div class="card">
        <div class="stat"><span class="stat-label">Salad</span><span class="stat-value"><span class="badge {{ 'badge-on' if salad else 'badge-off' }}">{{ 'Running' if salad else 'Not configured' }}</span></span></div>
        <div class="stat"><span class="stat-label">Vast.ai</span><span class="stat-value"><span class="badge {{ 'badge-on' if vastai else 'badge-off' }}">{{ 'Running' if vastai else 'Not configured' }}</span></span></div>
        <div class="stat"><span class="stat-label">io.net</span><span class="stat-value"><span class="badge {{ 'badge-on' if ionet else 'badge-off' }}">{{ 'Running' if ionet else 'Not configured' }}</span></span></div>
    </div>
    </body></html>
    """

    @app.route('/')
    def index():
        return render_template_string(DASHBOARD_HTML,
            version=NODE_VERSION,
            gpu_name=gpu_info['name'],
            gpu_vram=gpu_info['vram_gb'],
            wallet_short=WALLET[:6] + '...' + WALLET[-4:] if len(WALLET) > 10 else WALLET,
            compute_units=getattr(client, '_last_total', 0),
            unclaimed=getattr(client, '_last_unclaimed', 0),
            jobs=client.jobs_completed,
            current_task=client.current_task or 'Idle',
            salad=external.salad_running,
            vastai=external.vastai_running,
            ionet=external.ionet_running
        )

    @app.route('/api/status')
    def status():
        return jsonify({
            'gpu': gpu_info,
            'wallet': WALLET,
            'jobs_completed': client.jobs_completed,
            'current_task': client.current_task,
            'external': {
                'salad': external.salad_running,
                'vastai': external.vastai_running,
                'ionet': external.ionet_running
            }
        })

    app.run(host='0.0.0.0', port=3000, debug=False)

# ═══════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════

def main():
    print('=' * 50)
    print('  INCLAWBATOR COMPUTE NODE v' + NODE_VERSION)
    print('=' * 50)
    print()

    # Validate wallet
    if not WALLET:
        print('[ERROR] WALLET env var is required.')
        print('  docker run --gpus all -e WALLET=0xYourWallet inclawbate/compute-node')
        sys.exit(1)

    print(f'[WALLET] {WALLET}')

    # Detect GPU
    gpu = detect_gpu()
    print(f'[GPU] {gpu["name"]} ({gpu["vram_gb"]}GB VRAM)')

    # Initialize clients
    client = InclawbateClient(INCLAWBATE_API, WALLET, gpu)
    external = ExternalWorkerManager()

    # Register with Inclawbate
    print()
    print('[INCLAWBATE] Registering node...')
    if not client.register():
        print('[INCLAWBATE] Registration failed — will retry on heartbeat')

    # Start external market workers
    print()
    print('[EXTERNAL] Starting external market workers...')
    external.start_all()

    # Start local dashboard in background thread
    print()
    print('[DASHBOARD] Starting at http://localhost:3000')
    dash_thread = threading.Thread(target=start_dashboard, args=(client, external, gpu), daemon=True)
    dash_thread.start()

    # Graceful shutdown
    running = True
    def shutdown(sig, frame):
        nonlocal running
        print('\n[SHUTDOWN] Stopping node...')
        running = False
        external.stop_all()
        sys.exit(0)
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Main loop: heartbeat + job polling
    print()
    print('[ONLINE] Node is running. Earning compute units...')
    print(f'[ONLINE] Heartbeat every {HEARTBEAT_INTERVAL}s')
    print()

    while running:
        # 1. Check for Inclawbate jobs (priority)
        job = client.poll_job()
        if job:
            client.current_task = job.get('type', 'processing')
            external.pause_all()  # Pause external workers during Inclawbate job
            # TODO: process the job (run inference, return result)
            client.complete_job(job['id'], {})
            external.resume_all()  # Resume external workers
        else:
            client.current_task = 'idle (external markets active)' if any([
                external.salad_running, external.vastai_running, external.ionet_running
            ]) else 'idle'

        # 2. Send heartbeat
        hb = client.heartbeat()
        if hb:
            client._last_total = hb.get('total_compute_units', 0)
            client._last_unclaimed = hb.get('unclaimed_units', 0)
            units = hb.get('compute_units_earned', 0)
            total = hb.get('total_compute_units', 0)
            unclaimed = hb.get('unclaimed_units', 0)
            print(f'[{datetime.now().strftime("%H:%M:%S")}] +{units} units | Total: {total} | Unclaimed: {unclaimed}')

        # 3. Sleep until next cycle
        time.sleep(HEARTBEAT_INTERVAL)


if __name__ == '__main__':
    main()
