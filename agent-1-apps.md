# Agent 1 Task: Build 7 Health & Wellness Apps for SUITE

## Context
You are building simple web apps for the SUITE ecosystem (getsuite.app). Each app should be:
- A single HTML file with embedded CSS/JS
- Dark theme matching SUITE brand (bg: #0a0a0f, accent: #6366f1)
- Mobile-first responsive design
- LocalStorage for data persistence (no backend needed)
- Simple, focused on ONE problem

## Apps to Build

### 1. HydroTrack (`hydrotrack.html`)
Water intake tracker
- Big "Add Glass" button (250ml default)
- Daily goal: 8 glasses (2L)
- Progress ring/bar visualization
- Reset at midnight
- Simple stats (streak, average)

### 2. SleepWell (`sleepwell.html`)
Sleep quality logger
- Log bedtime & wake time
- Rate sleep quality 1-5
- Calculate hours slept
- Weekly average chart
- Tips based on patterns

### 3. MoodLog (`moodlog.html`)
Emotion tracker
- 5 mood options: Great, Good, Okay, Bad, Terrible (with emojis)
- Optional note field
- Calendar view of moods
- Weekly mood patterns
- Gratitude prompt option

### 4. PillPal (`pillpal.html`)
Medication reminder
- Add medications with schedule
- Check off when taken
- Visual pill counter
- Streak tracking
- Simple notification reminder text

### 5. BreathEasy (`breatheasy.html`)
Breathing exercises
- 4-7-8 breathing animation
- Box breathing option
- Visual circle that expands/contracts
- Session timer (1-5 min options)
- Calming ambient sounds (optional)

### 6. StepGoal (`stepgoal.html`)
Step counter interface
- Manual step entry (no hardware needed)
- Daily goal setting
- Progress bar
- Weekly chart
- Motivational messages

### 7. StretchTimer (`stretchtimer.html`)
Desk break reminder
- Set interval (30/45/60 min)
- Visual countdown
- Stretch suggestions when timer hits
- Track breaks taken today
- Sound alert option

## Technical Requirements
- Use CSS variables: --bg-dark: #0a0a0f; --accent: #6366f1; --text: #f8fafc
- Font: Inter or system sans-serif
- Include nav component: `<nav id="main-nav"></nav><script src="/nav-component.js"></script>`
- Save to root directory alongside other app HTML files
- Each file should be completely self-contained (embedded CSS and JS)

## File Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[App Name] | SUITE</title>
    <link rel="icon" type="image/png" href="/assets/suite-logo-new.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/nav.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg-dark: #0a0a0f;
            --bg-card: rgba(255,255,255,0.05);
            --accent: #6366f1;
            --accent-glow: rgba(99, 102, 241, 0.3);
            --text: #f8fafc;
            --text-dim: rgba(248,250,252,0.6);
            --success: #22c55e;
            --warning: #eab308;
            --error: #ef4444;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-dark);
            color: var(--text);
            min-height: 100vh;
            padding: 80px 20px 20px;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
        }
        h1 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: var(--text-dim);
            margin-bottom: 2rem;
        }
        .card {
            background: var(--bg-card);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        }
        .btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px var(--accent-glow);
        }
        .btn:active {
            transform: translateY(0);
        }
        .btn-secondary {
            background: var(--bg-card);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .progress-ring {
            width: 200px;
            height: 200px;
            margin: 2rem auto;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }
        .stat-item {
            text-align: center;
            padding: 1rem;
            background: var(--bg-card);
            border-radius: 12px;
        }
        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--accent);
        }
        .stat-label {
            font-size: 0.875rem;
            color: var(--text-dim);
        }
        /* Add your styles */
    </style>
</head>
<body>
    <nav id="main-nav"></nav>
    <script src="/nav-component.js"></script>

    <div class="container">
        <!-- App content -->
    </div>

    <script>
        // LocalStorage logic
    </script>
</body>
</html>
```

## Deliverables
1. Create all 7 HTML files in the root directory
2. Test each app works on mobile (responsive design)
3. Ensure LocalStorage saves and loads correctly
4. Make sure the nav component loads properly

## User Questions Each App Addresses

### HydroTrack (Water)
- "I never drink enough water"
- "How much water should I drink?"
- "I keep getting dehydrated"
- "I forget to drink water at work"

### SleepWell (Sleep)
- "I can't fall asleep"
- "I wake up tired"
- "How can I improve my sleep?"
- "I have insomnia"
- "What time should I go to bed?"

### MoodLog (Mental Health)
- "I feel anxious all the time"
- "My mood swings are crazy"
- "I want to track my mental health"
- "I feel depressed sometimes"
- "How do I manage stress?"

### PillPal (Medication)
- "I forget to take my vitamins"
- "I need medication reminders"
- "I missed my birth control"
- "When did I last take my meds?"

### BreathEasy (Stress Relief)
- "I'm having a panic attack"
- "I need to calm down right now"
- "How do I do breathing exercises?"
- "I'm so stressed out"

### StepGoal (Walking)
- "I want to walk 10,000 steps"
- "I'm too sedentary"
- "How many steps have I walked?"
- "I need to move more"

### StretchTimer (Desk Breaks)
- "I sit at my desk all day"
- "My neck hurts from computer work"
- "Remind me to take breaks"
- "I need desk stretches"
