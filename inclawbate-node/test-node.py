"""
Inclawbator Node — Lightweight Test Version
=============================================
Run this on any PC to test the compute network flow.
No Docker, no GPU required. Just Python + requests.

Usage:
  pip install requests
  python test-node.py --wallet 0xYourWalletAddress

This will:
  1. Register your node with Inclawbate
  2. Send heartbeats every 30s (earning compute units)
  3. Show your earnings in the terminal
"""

import os
import sys
import time
import argparse
import platform

try:
    import requests
except ImportError:
    print('Install requests first: pip install requests')
    sys.exit(1)

VERSION = '0.1.0-test'
API = os.environ.get('INCLAWBATE_API', 'https://www.inclawbate.app')

def main():
    parser = argparse.ArgumentParser(description='Inclawbator Compute Node (Test)')
    parser.add_argument('--wallet', required=True, help='Your wallet address (earns CLAWS)')
    parser.add_argument('--gpu', default='Test GPU', help='GPU name (for testing)')
    parser.add_argument('--vram', type=int, default=8, help='GPU VRAM in GB (for testing)')
    parser.add_argument('--interval', type=int, default=30, help='Heartbeat interval in seconds')
    args = parser.parse_args()

    print('=' * 50)
    print('  INCLAWBATOR NODE (Test Mode)')
    print('=' * 50)
    print(f'  Wallet:   {args.wallet}')
    print(f'  GPU:      {args.gpu} ({args.vram}GB)')
    print(f'  API:      {API}')
    print(f'  Interval: {args.interval}s')
    print()

    # Register
    print('[1/3] Registering node...')
    try:
        r = requests.post(f'{API}/api/inclawbate/compute/register', json={
            'wallet': args.wallet,
            'gpu_name': args.gpu,
            'gpu_vram_gb': args.vram,
            'os': platform.system(),
            'node_version': VERSION
        }, timeout=10)
        data = r.json()
        if data.get('ok'):
            print(f'  Registered! Node: {data["node"]["gpu_name"]}')
        else:
            print(f'  Registration issue: {data.get("error", "unknown")}')
    except Exception as e:
        print(f'  Failed to register: {e}')
        print('  Will retry on heartbeat...')

    print()
    print('[2/3] External markets: Not configured (test mode)')
    print('  Set SALAD_TOKEN, VASTAI_API_KEY, or IONET_DEVICE_ID to enable')
    print()
    print('[3/3] Starting heartbeat loop...')
    print()
    print('  Earning compute units. Press Ctrl+C to stop.')
    print('  ' + '-' * 46)

    try:
        while True:
            try:
                r = requests.post(f'{API}/api/inclawbate/compute/heartbeat', json={
                    'wallet': args.wallet,
                    'gpu_utilization': 0,
                    'jobs_completed': 0,
                    'current_task': 'idle (test mode)'
                }, timeout=10)
                data = r.json()
                if data.get('ok'):
                    ts = time.strftime('%H:%M:%S')
                    units = data.get('compute_units_earned', 0)
                    total = data.get('total_compute_units', 0)
                    unclaimed = data.get('unclaimed_units', 0)
                    print(f'  [{ts}] +{units} units | Total: {total} | Unclaimed: {unclaimed} CLAWS pending')
                else:
                    print(f'  Heartbeat error: {data.get("error")}')
            except Exception as e:
                print(f'  Heartbeat failed: {e}')

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print('\n\n  Node stopped. Your compute units are saved.')
        print(f'  Claim CLAWS: POST {API}/api/inclawbate/compute/claim')
        print()


if __name__ == '__main__':
    main()
