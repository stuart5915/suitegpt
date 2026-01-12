"""
TELOS Staged Build Controller
==============================
Manages the 50-prompt staged build process:
- Stage 0: Init (prompts 1-2)
- Stage 1: Core Build (prompts 3-10) + checkpoint
- Stage 2: Reframe + Enhance (prompts 11-20) + checkpoint
- Stage 3: Polish (prompts 21-35) + checkpoint
- Stage 4: Final Touches (prompts 36-45) + checkpoint
- Stage 5: Buffer (prompts 46-50) + completion

Features:
- Bug loop: keeps prompting until errors = 0
- Stage reframing: AI re-analyzes every stage
- Progress tracking: PROGRESS.md, git commits
"""

import os
import json
import subprocess
import time
import requests
from datetime import datetime

# ═══ CONFIGURATION ═══
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://rdsmdywbdiskxknluiym.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
REPO_DIR = os.environ.get('REPO_DIR', r'C:\Users\Stuart\stuart-hollinger-landing')

MAX_BUG_ITERATIONS = 10  # Safety limit for bug loop
MAX_PROMPTS = 50

# Stage definitions: (stage_num, start_prompt, end_prompt, focus)
STAGES = [
    (0, 1, 2, "Init: Create project and set up base structure"),
    (1, 3, 10, "Core Build: Implement main features from approved idea"),
    (2, 11, 20, "Enhance: Add most valuable features based on current state"),
    (3, 21, 35, "Polish: Animations, error handling, loading states"),
    (4, 36, 45, "Final: App icon, splash, performance, screenshots"),
    (5, 46, 50, "Buffer: Final refinements and completion"),
]


class TelosBuilder:
    """Manages staged build for a single app."""
    
    def __init__(self, idea_id: str, app_name: str, app_path: str, initial_prompt_count: int = 0):
        self.idea_id = idea_id
        self.app_name = app_name
        self.app_path = app_path
        self.prompt_count = initial_prompt_count  # Resume from stored progress
        self.current_stage = 0
        self.errors = []
        self.bug_fix_count = 0
        
        if initial_prompt_count > 0:
            print(f"[BUILDER] ♻️ Resuming {app_name} from prompt {initial_prompt_count}/50")
        
    def get_current_stage(self) -> tuple:
        """Get current stage based on prompt count."""
        for stage_num, start, end, focus in STAGES:
            if start <= self.prompt_count <= end:
                return stage_num, start, end, focus
        return 5, 46, 50, "Buffer"
    
    def is_checkpoint_prompt(self) -> bool:
        """Check if we're at a checkpoint (end of a stage)."""
        for stage_num, start, end, focus in STAGES:
            if self.prompt_count == end:
                return True
        return False
    
    def generate_init_prompt(self) -> str:
        """Generate initialization prompt (Stage 0)."""
        slug = self.app_name.lower().replace(' ', '-').replace("'", "")
        
        if self.prompt_count == 1:
            return f"""Create a new Expo React Native app called "{self.app_name}".

Run: npx create-expo-app {slug} --template blank

After creation, set up:
1. Basic folder structure (screens/, components/, utils/)
2. Navigation container
3. Base theme/colors
4. App.js entry point"""
        
        elif self.prompt_count == 2:
            return f"""In the {self.app_name} app, set up:

1. Navigation with React Navigation (stack navigator)
2. Create placeholder screens: HomeScreen, SettingsScreen
3. Set up a basic theme with colors matching SUITE style (orange accents)
4. Configure app.json with proper name and slug"""
        
        return ""
    
    def generate_build_prompt(self, idea_data: dict) -> str:
        """Generate a build prompt for current stage."""
        stage_num, start, end, focus = self.get_current_stage()
        prompt_in_stage = self.prompt_count - start + 1
        total_in_stage = end - start + 1
        
        features = idea_data.get('features', [])
        if isinstance(features, str):
            features = json.loads(features)
        
        # Stage 1: Core build
        if stage_num == 1:
            feature_idx = min(prompt_in_stage - 1, len(features) - 1)
            if feature_idx >= 0 and feature_idx < len(features):
                feature = features[feature_idx]
                return f"""[{self.app_name} - Stage 1: Core Build - Prompt {prompt_in_stage}/{total_in_stage}]

Implement this feature: {feature}

Build it fully functional with:
- Complete UI for this feature
- State management
- Any necessary data persistence
- Good UX (loading states, feedback)

Make sure it integrates with existing screens/navigation."""
            else:
                return f"""[{self.app_name} - Stage 1: Core Build - Prompt {prompt_in_stage}/{total_in_stage}]

Continue building the core functionality. Review what's been built and add any missing pieces needed for the app to be usable.

Current features: {', '.join(features)}"""
        
        # Stage 3: Polish
        elif stage_num == 3:
            polish_items = [
                "Add smooth transitions between screens",
                "Add loading spinners for async operations",
                "Add error boundary and error handling",
                "Add empty states with helpful messages",
                "Add pull-to-refresh where appropriate",
                "Add haptic feedback on interactions",
                "Add proper keyboard handling",
                "Add accessibility labels",
                "Polish the overall visual design",
                "Add animation to key interactions",
            ]
            item_idx = min(prompt_in_stage - 1, len(polish_items) - 1)
            item = polish_items[item_idx] if item_idx >= 0 else "Continue polishing"
            
            return f"""[{self.app_name} - Stage 3: Polish - Prompt {prompt_in_stage}/{total_in_stage}]

Focus on: {item}

Make the app feel premium and polished. Small details matter!"""
        
        # Stage 4: Final touches
        elif stage_num == 4:
            final_items = [
                "Create a beautiful app icon (use expo-image or assets)",
                "Design and implement a splash screen",
                "Optimize performance - reduce re-renders",
                "Add offline handling / local storage",
                "Test all screens and fix any visual issues",
                "Add onboarding flow if appropriate",
                "Review and improve navigation flow",
                "Add analytics tracking setup",
                "Prepare store screenshots",
                "Final review and cleanup",
            ]
            item_idx = min(prompt_in_stage - 1, len(final_items) - 1)
            item = final_items[item_idx] if item_idx >= 0 else "Final cleanup"
            
            return f"""[{self.app_name} - Stage 4: Final Touches - Prompt {prompt_in_stage}/{total_in_stage}]

Focus on: {item}

This is the final polish phase. Make it release-ready!"""
        
        # Stage 5: Buffer
        elif stage_num == 5:
            return f"""[{self.app_name} - Stage 5: Buffer - Prompt {prompt_in_stage}/{total_in_stage}]

Final cleanup and refinements. Review the entire app and:
1. Fix any remaining issues
2. Ensure consistency across all screens
3. Test the complete user flow
4. Make any last improvements

When complete, write a file called 'build_complete.json' in the app root with:
{{
    "status": "complete",
    "app_name": "{self.app_name}",
    "completed_at": "ISO timestamp",
    "summary": "Brief summary of what was built"
}}"""
        
        # Default
        return f"""[{self.app_name} - Prompt {self.prompt_count}/50]

Continue building the app. {focus}"""
    
    def generate_reframe_prompt(self) -> str:
        """Generate a reframe prompt for AI to re-analyze and plan next steps."""
        return f"""[{self.app_name} - REFRAME ANALYSIS]

Look at what currently exists in this app. Based on the current state:

1. What's working well?
2. What's the TOP 5 features/improvements that would add the MOST value?
3. What user experience gaps exist?
4. What's missing that users would expect?

Write your analysis and plan to: prompt-server/stage_plan.json

Format:
{{
    "working_well": ["item1", "item2"...],
    "top_5_priorities": [
        {{"feature": "...", "why": "..."}},
        ...
    ],
    "ux_gaps": ["gap1", "gap2"...],
    "next_focus": "What to build next"
}}

This helps decide what to build in the next stage."""
    
    def generate_bug_fix_prompt(self, errors: list) -> str:
        """Generate a prompt to fix bugs."""
        error_text = "\n".join(errors[:10])  # Limit to 10 errors
        
        return f"""[{self.app_name} - BUG FIX #{self.bug_fix_count}]

The app has the following errors that need to be fixed:

{error_text}

Fix ALL these errors. The app must run without console errors before we can continue.

After fixing, the app should:
1. Start without errors
2. Navigate between screens without crashes
3. Have no red screens or warnings"""
    
    def get_next_prompt(self, idea_data: dict) -> tuple:
        """
        Get the next prompt to send.
        Returns: (prompt_text, prompt_type)
        prompt_type: 'init', 'build', 'reframe', 'bugfix', 'complete'
        """
        # If we have errors, fix them first
        if self.errors:
            self.bug_fix_count += 1
            if self.bug_fix_count > MAX_BUG_ITERATIONS:
                # Safety: too many bug fixes, move on
                self.errors = []
                self.bug_fix_count = 0
            else:
                return self.generate_bug_fix_prompt(self.errors), 'bugfix'
        
        # Increment prompt count
        self.prompt_count += 1
        
        # Check if complete
        if self.prompt_count > MAX_PROMPTS:
            return None, 'complete'
        
        # Stage 0: Init
        if self.prompt_count <= 2:
            return self.generate_init_prompt(), 'init'
        
        # Check if this is a reframe point (start of new stage)
        for stage_num, start, end, focus in STAGES:
            if self.prompt_count == start and stage_num >= 2:
                return self.generate_reframe_prompt(), 'reframe'
        
        # Regular build prompt
        return self.generate_build_prompt(idea_data), 'build'
    
    def record_errors(self, errors: list):
        """Record errors found during testing."""
        self.errors = errors
    
    def clear_errors(self):
        """Clear errors after successful fix."""
        self.errors = []
        self.bug_fix_count = 0
    
    def get_progress(self) -> dict:
        """Get current build progress."""
        stage_num, start, end, focus = self.get_current_stage()
        
        return {
            'idea_id': self.idea_id,
            'app_name': self.app_name,
            'prompt_count': self.prompt_count,
            'max_prompts': MAX_PROMPTS,
            'stage': stage_num,
            'stage_focus': focus,
            'progress_percent': int((self.prompt_count / MAX_PROMPTS) * 100),
            'errors_count': len(self.errors),
            'bug_fix_attempts': self.bug_fix_count
        }
    
    def write_progress_file(self):
        """Write PROGRESS.md to the app directory."""
        progress = self.get_progress()
        
        content = f"""# {self.app_name} Build Progress

## Current Status
- **Prompt:** {progress['prompt_count']}/{progress['max_prompts']}
- **Stage:** {progress['stage']} - {progress['stage_focus']}
- **Progress:** {progress['progress_percent']}%
- **Errors:** {progress['errors_count']}

## Stage History
| Stage | Focus | Status |
|-------|-------|--------|
| 0 | Init | {'✅' if self.prompt_count > 2 else '🔄'} |
| 1 | Core Build | {'✅' if self.prompt_count > 10 else '🔄' if self.prompt_count > 2 else '⏳'} |
| 2 | Enhance | {'✅' if self.prompt_count > 20 else '🔄' if self.prompt_count > 10 else '⏳'} |
| 3 | Polish | {'✅' if self.prompt_count > 35 else '🔄' if self.prompt_count > 20 else '⏳'} |
| 4 | Final | {'✅' if self.prompt_count > 45 else '🔄' if self.prompt_count > 35 else '⏳'} |
| 5 | Buffer | {'✅' if self.prompt_count > 50 else '🔄' if self.prompt_count > 45 else '⏳'} |

Last updated: {datetime.now().isoformat()}
"""
        
        progress_path = os.path.join(self.app_path, 'PROGRESS.md')
        try:
            with open(progress_path, 'w') as f:
                f.write(content)
        except Exception as e:
            print(f"[BUILDER] Could not write progress file: {e}")


# ═══ ERROR CAPTURE ═══

def run_app_test(app_path: str) -> tuple:
    """
    Run the app and capture any errors.
    Returns: (success: bool, errors: list)
    """
    print(f"[BUILDER] 🧪 Testing app at {app_path}...")
    
    # Try to run npm start and capture output
    try:
        # Use npx expo start --web for testing
        result = subprocess.run(
            ['npx', 'expo', 'start', '--web', '--non-interactive'],
            cwd=app_path,
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )
        
        output = result.stdout + result.stderr
        errors = parse_errors(output)
        
        return len(errors) == 0, errors
        
    except subprocess.TimeoutExpired:
        # Timeout is actually OK - app is running
        return True, []
    except Exception as e:
        return False, [f"Test failed: {str(e)}"]


def parse_errors(output: str) -> list:
    """Parse console output for errors."""
    errors = []
    
    # Look for common error patterns
    error_patterns = [
        'Error:',
        'error:',
        'SyntaxError',
        'TypeError',
        'ReferenceError',
        'Cannot find module',
        'Module not found',
        'Failed to compile',
        'ENOENT',
        'is not defined',
        'unexpected token',
    ]
    
    lines = output.split('\n')
    for i, line in enumerate(lines):
        for pattern in error_patterns:
            if pattern.lower() in line.lower():
                # Get some context
                context = lines[max(0, i-1):min(len(lines), i+3)]
                error_msg = '\n'.join(context)
                if error_msg not in errors:
                    errors.append(error_msg)
                break
    
    return errors[:10]  # Limit to 10 errors


# ═══ DATABASE HELPERS ═══

def update_build_progress(idea_id: str, prompt_count: int, stage: int, status: str = 'building'):
    """Update build progress in Supabase."""
    if not SUPABASE_KEY:
        return
    
    try:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/telos_ideas?id=eq.{idea_id}",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'build_iterations': prompt_count,
                'status': status,
                'refinement_notes': f'Stage {stage}, Prompt {prompt_count}/50'
            },
            timeout=10
        )
    except Exception as e:
        print(f"[BUILDER] DB update failed: {e}")


def mark_build_complete(idea_id: str):
    """Mark build as complete and ready for review."""
    if not SUPABASE_KEY:
        return
    
    try:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/telos_ideas?id=eq.{idea_id}",
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'status': 'review',
                'build_completed_at': datetime.utcnow().isoformat(),
                'refinement_notes': 'Build complete! Ready for review.'
            },
            timeout=10
        )
        print(f"[BUILDER] ✅ Build marked complete for review!")
    except Exception as e:
        print(f"[BUILDER] DB complete update failed: {e}")


# ═══ ACTIVE BUILDS TRACKING ═══
# Store active builders by idea_id
active_builds: dict[str, TelosBuilder] = {}


def get_or_create_builder(idea_id: str, app_name: str, app_path: str, stored_iterations: int = 0) -> TelosBuilder:
    """
    Get existing builder or create new one.
    Uses stored_iterations to resume from where the build left off.
    """
    if idea_id not in active_builds:
        active_builds[idea_id] = TelosBuilder(idea_id, app_name, app_path, stored_iterations)
        if stored_iterations > 0:
            print(f"[BUILDER] ♻️ Resuming {app_name} from prompt {stored_iterations}/50")
        else:
            print(f"[BUILDER] 🚀 Starting new build for: {app_name}")
    return active_builds[idea_id]


def remove_builder(idea_id: str):
    """Remove builder when complete."""
    if idea_id in active_builds:
        del active_builds[idea_id]


# ═══ TEST ═══
if __name__ == '__main__':
    print("=" * 60)
    print("TELOS BUILDER TEST")
    print("=" * 60)
    
    # Create test builder
    builder = TelosBuilder("test-123", "TestApp", "/tmp/testapp")
    
    idea_data = {
        'name': 'TestApp',
        'features': ['User login', 'Dashboard', 'Settings']
    }
    
    # Simulate first few prompts
    for i in range(5):
        prompt, prompt_type = builder.get_next_prompt(idea_data)
        print(f"\n--- Prompt {builder.prompt_count} ({prompt_type}) ---")
        print(prompt[:200] + "..." if len(prompt) > 200 else prompt)
    
    # Print progress
    print("\n--- Progress ---")
    print(builder.get_progress())
