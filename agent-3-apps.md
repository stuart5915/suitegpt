# Agent 3 Task: Build 6 Lifestyle & Social Apps for SUITE

## Context
You are building simple web apps for the SUITE ecosystem (getsuite.app). Each app should be:
- A single HTML file with embedded CSS/JS
- Dark theme matching SUITE brand (bg: #0a0a0f, accent: #6366f1)
- Mobile-first responsive design
- LocalStorage for data persistence (no backend needed)
- Simple, focused on ONE problem

## Apps to Build

### 15. DateNight (`datenight.html`)
Date idea generator
- Random date idea button
- Categories: Romantic, Adventure, Budget, Home
- Save favorite ideas
- "We did this" history
- Custom idea submission
- Shuffle feature

### 16. PetCare (`petcare.html`)
Pet tracker
- Add pets (name, type, birthday)
- Log: Feeding, Walks, Vet visits, Medications
- Reminders for recurring tasks
- Pet profile with photo placeholder
- Health notes

### 17. PackLight (`packlight.html`)
Packing list generator
- Trip type: Beach, Business, Winter, Camping
- Duration selector
- Auto-generate checklist
- Check items as packed
- Save custom templates
- Share list option

### 18. GiftGuru (`giftguru.html`)
Gift tracker
- Add people with interests/sizes
- Gift ideas per person
- Mark gifts as bought/wrapped/given
- Budget per person
- Upcoming birthdays reminder
- Gift history

### 19. HabitStack (`habitstack.html`)
Habit chain builder
- Create morning/evening routines
- Chain habits in sequence
- Check off as completed
- Streak counter per habit
- Visual chain (don't break it!)
- Time estimates

### 20. QuickDecide (`quickdecide.html`)
Decision helper
- Add 2-4 options
- Random picker with animation
- Coin flip mode
- Pro/Con list mode
- History of decisions
- "Feeling lucky" random choice

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
1. Create all 6 HTML files in the root directory
2. Test each app works on mobile (responsive design)
3. Ensure LocalStorage saves and loads correctly
4. Make sure the nav component loads properly

## User Questions Each App Addresses

### DateNight (Relationships)
- "I need date ideas"
- "What should we do tonight?"
- "Cheap date night ideas"
- "Plan a romantic evening"

### PetCare (Pets)
- "When is my dog's vet appointment?"
- "Track pet vaccinations"
- "My cat's feeding schedule"
- "Pet medication reminders"

### PackLight (Travel)
- "What should I pack?"
- "I always forget something"
- "Packing list for beach trip"
- "Minimalist travel packing"

### GiftGuru (Gifts)
- "What gift should I buy?"
- "Gift ideas for mom"
- "I never know what to get"
- "Birthday gift suggestions"

### HabitStack (Habits)
- "How do I build habits?"
- "I can't stick to routines"
- "Chain my morning habits"
- "Habit tracking app"

### QuickDecide (Decisions)
- "Should I do A or B?"
- "I can't decide"
- "Flip a coin for me"
- "Help me make a choice"
