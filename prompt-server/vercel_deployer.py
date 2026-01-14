"""
Vercel API Deployer for SUITE Apps
Handles automated deployment of built apps to Vercel
"""
import os
import sys
import time
import json
import requests
from pathlib import Path

# Configuration from environment
VERCEL_TOKEN = os.environ.get('VERCEL_TOKEN', '')
VERCEL_TEAM_ID = os.environ.get('VERCEL_TEAM_ID', '')  # Optional for team accounts

class VercelDeployer:
    """Handles deployment to Vercel via REST API"""
    
    def __init__(self, token=None, team_id=None):
        self.token = token or VERCEL_TOKEN
        self.team_id = team_id or VERCEL_TEAM_ID
        
        if not self.token:
            raise ValueError("VERCEL_TOKEN environment variable not set")
        
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        self.api_base = 'https://api.vercel.com'
    
    def deploy(self, app_path: str, app_name: str, project_name: str = None) -> dict:
        """
        Deploy an app folder to Vercel and return deployment info.
        
        Args:
            app_path: Absolute path to app directory
            app_name: Human-readable app name (e.g., "Cheshbon Reflections")
            project_name: Vercel project name (defaults to slugified app_name)
        
        Returns:
            dict: {
                'success': bool,
                'url': str,  # Production URL
                'project_name': str,
                'deployment_id': str,
                'error': str (if failed)
            }
        """
        print(f'[VERCEL] Starting deployment for {app_name}...')
        
        # Convert to Path object
        app_path = Path(app_path).resolve()
        
        if not app_path.exists() or not app_path.is_dir():
            return {
                'success': False,
                'error': f'App path does not exist: {app_path}'
            }
        
        # Generate project name from app name if not provided
        if not project_name:
            project_name = self._slugify(app_name)
        
        try:
            # Step 1: Ensure project exists (create if needed)
            project = self._ensure_project(project_name, app_name)
            if not project:
                return {
                    'success': False,
                    'error': 'Failed to create/get Vercel project'
                }
            
            # Step 2: Create deployment
            deployment_id = self._create_deployment(app_path, project_name)
            if not deployment_id:
                return {
                    'success': False,
                    'error': 'Failed to create deployment'
                }
            
            # Step 3: Wait for deployment to be ready
            prod_url = self._wait_for_deployment(deployment_id, project_name)
            if not prod_url:
                return {
                    'success': False,
                    'error': 'Deployment timed out or failed'
                }
            
            # Step 4: Add custom getsuite.app domain
            custom_domain = f"{project_name}.getsuite.app"
            domain_added = self._add_custom_domain(project_name, custom_domain)
            
            print(f'[VERCEL] ✅ Deployment successful: {prod_url}')
            if domain_added:
                print(f'[VERCEL] ✅ Custom domain added: https://{custom_domain}')
           
            return {
                'success': True,
                'url': prod_url,
                'custom_url': f'https://{custom_domain}' if domain_added else None,
                'project_name': project_name,
                'deployment_id': deployment_id
            }
            
        except Exception as e:
            print(f'[VERCEL] ❌ Deployment failed: {e}')
            return {
                'success': False,
                'error': str(e)
            }
    
    def _slugify(self, text: str) -> str:
        """Convert app name to Vercel-safe project name"""
        import re
        # Remove emojis and special chars, lowercase, replace spaces with hyphens
        text = re.sub(r'[^\w\s-]', '', text.lower())
        text = re.sub(r'[\s_]+', '-', text)
        return text.strip('-')
    
    def _add_custom_domain(self, project_name: str, domain: str) -> bool:
        """Add a custom domain to the Vercel project"""
        print(f'[VERCEL] Adding custom domain: {domain}...')
        
        url = f'{self.api_base}/v10/projects/{project_name}/domains'
        if self.team_id:
            url += f'?teamId={self.team_id}'
        
        payload = {
            'name': domain
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        
        if response.status_code in [200, 201]:
            print(f'[VERCEL] ✅ Custom domain added: {domain}')
            return True
        elif response.status_code == 409:
            # Domain already exists on this project
            print(f'[VERCEL] ℹ️ Domain already configured: {domain}')
            return True
        else:
            print(f'[VERCEL] ⚠️ Could not add domain: {response.text}')
            return False
    
    def _ensure_project(self, project_name: str, display_name: str) -> dict:
        """Create Vercel project if it doesn't exist, or return existing"""
        print(f'[VERCEL] Checking project: {project_name}...')
        
        # Check if project exists
        url = f'{self.api_base}/v9/projects/{project_name}'
        if self.team_id:
            url += f'?teamId={self.team_id}'
        
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            print(f'[VERCEL] Project exists: {project_name}')
            return response.json()
        
        # Create new project
        print(f'[VERCEL] Creating new project: {project_name}...')
        url = f'{self.api_base}/v10/projects'
        if self.team_id:
            url += f'?teamId={self.team_id}'
        
        payload = {
            'name': project_name,
            'framework': None,  # Auto-detect
            'publicSource': False
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        
        if response.status_code in [200, 201]:
            print(f'[VERCEL] ✅ Project created: {project_name}')
            return response.json()
        else:
            print(f'[VERCEL] ❌ Failed to create project: {response.text}')
            return None
    
    def _create_deployment(self, app_path: Path, project_name: str) -> str:
        """Upload files and create deployment"""
        print(f'[VERCEL] Creating deployment for {project_name}...')
        
        # Get list of files to deploy
        files = self._get_deployment_files(app_path)
        
        if not files:
            print('[VERCEL] No files to deploy!')
            return None
        
        print(f'[VERCEL] Uploading {len(files)} files...')
        
        # Create deployment payload
        url = f'{self.api_base}/v13/deployments'
        if self.team_id:
            url += f'?teamId={self.team_id}'
        
        payload = {
            'name': project_name,
            'project': project_name,
            'files': files,  
            'target': 'production'
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        
        if response.status_code in [200, 201]:
            data = response.json()
            deployment_id = data.get('id')
            print(f'[VERCEL] ✅ Deployment created: {deployment_id}')
            return deployment_id
        else:
            print(f'[VERCEL] ❌ Deployment failed: {response.text}')
            return None
    
    def _get_deployment_files(self, app_path: Path) -> list:
        """Get all files in app directory for deployment"""
        files = []
        
        # Ignore patterns
        ignore_patterns = {
            'node_modules', '.git', '.next', 'dist', 'build',
            '__pycache__', '.DS_Store', '.env*', '*.log'
        }
        
        for file_path in app_path.rglob('*'):
            if file_path.is_file():
                # Check if should ignore
                should_ignore = False
                for pattern in ignore_patterns:
                    if pattern.startswith('*'):
                        if file_path.name.endswith(pattern[1:]):
                            should_ignore = True
                    elif pattern in file_path.parts:
                        should_ignore = True
                
                if should_ignore:
                    continue
                
                # Read file content
                try:
                    # Get relative path from app root
                    rel_path = file_path.relative_to(app_path)
                    
                    # Read file as bytes
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    
                    # Encode to base64 for API
                    import base64
                    encoded = base64.b64encode(content).decode('utf-8')
                    
                    files.append({
                        'file': str(rel_path).replace('\\', '/'),
                        'data': encoded,
                        'encoding': 'base64'
                    })
                    
                except Exception as e:
                    print(f'[VERCEL] Warning: Could not read {file_path}: {e}')
        
        return files
    
    def _wait_for_deployment(self, deployment_id: str, project_name: str, timeout: int = 300) -> str:
        """Wait for deployment to be ready and return production URL"""
        print(f'[VERCEL] Waiting for deployment {deployment_id} to be ready...')
        
        url = f'{self.api_base}/v13/deployments/{deployment_id}'
        if self.team_id:
            url += f'?teamId={self.team_id}'
        
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            response = requests.get(url, headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                state = data.get('readyState')
                
                if state == 'READY':
                    # Get production URL
                    prod_url = f"https://{project_name}.vercel.app"
                    return prod_url
                
                elif state == 'ERROR' or state == 'CANCELED':
                    print(f'[VERCEL] ❌ Deployment failed with state: {state}')
                    return None
                
                # Still building
                print(f'[VERCEL] Deployment state: {state}... waiting...')
            
            time.sleep(5)
        
        print('[VERCEL] ⏱️ Deployment timed out')
        return None


# Supabase config for updating app URLs
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rdsmdywbdiskxknluiym.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

def update_app_url_in_supabase(app_slug: str, custom_url: str) -> bool:
    """Update the app_url field in the apps table after deployment"""
    if not SUPABASE_KEY:
        print('[SUPABASE] Warning: No SUPABASE_SERVICE_KEY set, skipping DB update')
        return False
    
    try:
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
        
        # Update by slug
        response = requests.patch(
            f'{SUPABASE_URL}/rest/v1/apps?slug=eq.{app_slug}',
            headers=headers,
            json={'app_url': custom_url, 'status': 'published'}
        )
        
        if response.status_code in [200, 204]:
            print(f'[SUPABASE] ✅ Updated app_url for {app_slug} to {custom_url}')
            return True
        else:
            print(f'[SUPABASE] ⚠️ Failed to update app_url: {response.text}')
            return False
    except Exception as e:
        print(f'[SUPABASE] ❌ Error updating app_url: {e}')
        return False


# Helper function for easy use
def deploy_app(app_path: str, app_name: str, app_slug: str = None) -> dict:
    """Deploy an app to Vercel and update Supabase with the new URL"""
    deployer = VercelDeployer()
    result = deployer.deploy(app_path, app_name)
    
    # If deployment successful and we have a slug, update Supabase
    if result.get('success') and result.get('custom_url') and app_slug:
        update_app_url_in_supabase(app_slug, result['custom_url'])
    
    return result


if __name__ == '__main__':
    # Test deployment
    if len(sys.argv) < 3:
        print('Usage: python vercel_deployer.py <app_path> <app_name> [app_slug]')
        sys.exit(1)
    
    app_path = sys.argv[1]
    app_name = sys.argv[2]
    app_slug = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = deploy_app(app_path, app_name, app_slug)
    print(json.dumps(result, indent=2))

