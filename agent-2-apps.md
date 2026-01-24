# Agent 2 Task: Build 7 Productivity & Learning Apps for SUITE

## Context
You are building simple web apps for the SUITE ecosystem (getsuite.app). Each app should be:
- A single HTML file with embedded CSS/JS
- Dark theme matching SUITE brand (bg: #0a0a0f, accent: #6366f1)
- Mobile-first responsive design
- LocalStorage for data persistence (no backend needed)
- Simple, focused on ONE problem

## Apps to Build

### 8. FocusFlow (`focusflow.html`)
Pomodoro timer
- 25 min work / 5 min break default
- Customizable durations
- Visual countdown circle
- Session counter
- Stats: sessions today, total focus time
- Sound notification

### 9. QuickBudget (`quickbudget.html`)
Simple expense tracker
- Add expense (amount, category, note)
- Categories: Food, Transport, Shopping, Bills, Other
- Daily/weekly/monthly totals
- Simple category breakdown chart
- Set monthly budget limit

### 10. FlashMind (`flashmind.html`)
Flashcard creator
- Create decks
- Add cards (front/back)
- Study mode with flip animation
- Mark as "Know" or "Review"
- Spaced repetition (show "Review" cards more)
- Progress percentage

### 11. BookShelf (`bookshelf.html`)
Reading tracker
- Add books (title, author, pages)
- Status: Want to Read, Reading, Finished
- Track current page
- Reading stats (books/month)
- Star rating when finished
- Simple book cover colors

### 12. SkillTree (`skilltree.html`)
Learning progress tracker
- Add skills to learn
- Break into milestones
- Check off progress
- Visual progress bar per skill
- Celebration on completion
- Time spent tracking

### 13. MealPrep (`mealprep.html`)
Weekly meal planner
- 7-day grid (Breakfast, Lunch, Dinner)
- Add meals to slots
- Save favorite meals
- Generate shopping list from meals
- Swap meals easily
- Clear week button

### 14. CleanHome (`cleanhome.html`)
Cleaning schedule
- Add rooms/areas
- Set cleaning frequency (daily/weekly/monthly)
- Check off when done
- Shows what's overdue
- Suggested cleaning tasks
- Reset weekly

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
1. Create all 7 HTML files in the root directory
2. Test each app works on mobile (responsive design)
3. Ensure LocalStorage saves and loads correctly
4. Make sure the nav component loads properly

## User Questions Each App Addresses

### FocusFlow (Productivity)
- "I can't concentrate"
- "I procrastinate too much"
- "How do I focus better?"
- "I need a Pomodoro timer"

### QuickBudget (Money)
- "Where does my money go?"
- "I need to track spending"
- "I'm bad with money"
- "Simple budget tracker"

### FlashMind (Study)
- "I need to study for an exam"
- "How do I memorize things?"
- "Create flashcards for me"
- "I'm learning a new language"

### BookShelf (Reading)
- "I want to read more"
- "What should I read next?"
- "How many books have I read?"
- "Track my reading progress"

### SkillTree (Learning)
- "I want to learn guitar"
- "How do I track my progress?"
- "I'm learning to code"
- "I want to improve at something"

### MealPrep (Cooking)
- "What should I cook this week?"
- "I need meal ideas"
- "I waste food because no plan"
- "Weekly dinner planning"

### CleanHome (Cleaning)
- "My house is always messy"
- "When should I clean?"
- "Cleaning schedule app"
- "I never remember chores"
