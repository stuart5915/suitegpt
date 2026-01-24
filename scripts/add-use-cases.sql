-- Add new use cases for the 20 new SUITE apps
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

INSERT INTO use_cases (query, response, recommended_app, category, helpful_count, is_visible) VALUES
-- Health & Wellness
('I never drink enough water', 'HydroTrack makes it easy - just tap to log each glass and watch your progress.', 'hydrotrack', 'health', 72, true),
('I keep getting dehydrated', 'HydroTrack helps you build the habit of drinking enough water daily.', 'hydrotrack', 'health', 45, true),
('I cant sleep well at night', 'SleepWell helps you track sleep patterns and find what works for you.', 'sleepwell', 'health', 68, true),
('I wake up tired every morning', 'SleepWell tracks your sleep quality so you can identify what affects your rest.', 'sleepwell', 'health', 52, true),
('I feel anxious all the time', 'MoodLog helps you track emotions and spot patterns. BreathEasy has calming exercises.', 'moodlog', 'health', 81, true),
('I want to track my mental health', 'MoodLog lets you log moods daily and see patterns over time.', 'moodlog', 'health', 61, true),
('I keep forgetting my vitamins', 'PillPal tracks all your medications and helps you never miss a dose.', 'pillpal', 'health', 65, true),
('I need medication reminders', 'PillPal creates schedules for all your meds with streak tracking.', 'pillpal', 'health', 48, true),
('I need to calm down right now', 'BreathEasy has guided 4-7-8 and box breathing exercises to help you relax.', 'breatheasy', 'health', 77, true),
('How do I do breathing exercises', 'BreathEasy guides you through calming techniques with visual animations.', 'breatheasy', 'health', 43, true),
('I want to walk more', 'StepGoal lets you set daily targets and track your progress over time.', 'stepgoal', 'health', 59, true),
('Im too sedentary', 'StepGoal helps you set step goals and build a walking habit.', 'stepgoal', 'health', 51, true),
('I sit at my desk all day', 'StretchTimer reminds you to take breaks and suggests desk stretches.', 'stretchtimer', 'health', 56, true),
('My neck hurts from computer work', 'StretchTimer gives you break reminders with quick stretches for desk workers.', 'stretchtimer', 'health', 49, true),

-- Productivity & Learning
('I cant focus at work anymore', 'FocusFlow uses the Pomodoro technique to help you concentrate in focused sprints.', 'focusflow', 'productivity', 58, true),
('I procrastinate too much', 'FocusFlow Pomodoro timer helps you work in focused bursts with built-in breaks.', 'focusflow', 'productivity', 84, true),
('Where does all my money go', 'QuickBudget tracks your expenses by category so you can see exactly where it goes.', 'quickbudget', 'finance', 79, true),
('I need a simple budget tracker', 'QuickBudget is dead simple - just log expenses and see your spending breakdown.', 'quickbudget', 'finance', 55, true),
('I need to study for an exam', 'FlashMind creates flashcards with spaced repetition to help you memorize.', 'flashmind', 'learning', 71, true),
('How do I memorize things better', 'FlashMind uses spaced repetition - you see cards you struggle with more often.', 'flashmind', 'learning', 46, true),
('I want to read more books', 'BookShelf tracks your reading list, progress, and helps you hit your goals.', 'bookshelf', 'learning', 63, true),
('How many books have I read', 'BookShelf tracks everything - want to read, currently reading, and finished books.', 'bookshelf', 'learning', 41, true),
('I want to learn a new skill', 'SkillTree breaks skills into milestones and tracks your progress visually.', 'skilltree', 'learning', 66, true),
('How do I track my learning progress', 'SkillTree lets you add skills, set milestones, and see your progress bars fill up.', 'skilltree', 'learning', 44, true),
('I never know what to cook', 'MealPrep helps you plan your whole week and generates a shopping list.', 'mealprep', 'lifestyle', 74, true),
('I need weekly dinner ideas', 'MealPrep has a 7-day grid where you plan meals and save favorites.', 'mealprep', 'lifestyle', 53, true),
('My house is always messy', 'CleanHome creates a cleaning schedule so you know exactly what to do when.', 'cleanhome', 'lifestyle', 62, true),
('I need a cleaning schedule', 'CleanHome tracks rooms, sets frequencies, and shows whats overdue.', 'cleanhome', 'lifestyle', 47, true),

-- Lifestyle & Social
('I need date night ideas', 'DateNight has tons of ideas - romantic, budget-friendly, adventurous, or at-home.', 'datenight', 'lifestyle', 69, true),
('What should we do tonight', 'DateNight can pick a random date idea or let you browse by category.', 'datenight', 'lifestyle', 54, true),
('I need to track my pets vet visits', 'PetCare keeps track of all your pets health info, feeding, and appointments.', 'petcare', 'lifestyle', 57, true),
('When is my dogs next vaccination', 'PetCare tracks vet visits, medications, and sets reminders for recurring care.', 'petcare', 'lifestyle', 42, true),
('I always forget things when traveling', 'PackLight generates packing lists based on your trip type and duration.', 'packlight', 'lifestyle', 73, true),
('What should I pack for a beach trip', 'PackLight auto-generates checklists for beach, business, winter, or camping trips.', 'packlight', 'lifestyle', 58, true),
('I never know what gift to buy', 'GiftGuru helps you track gift ideas for everyone and never forget a birthday.', 'giftguru', 'lifestyle', 64, true),
('Gift ideas for my mom', 'GiftGuru lets you save peoples interests and track gift ideas per person.', 'giftguru', 'lifestyle', 51, true),
('I want to build better habits', 'HabitStack lets you chain habits together and track your streaks.', 'habitstack', 'productivity', 82, true),
('How do I stick to a morning routine', 'HabitStack chains habits in sequence so completing one triggers the next.', 'habitstack', 'productivity', 59, true),
('I cant decide between options', 'QuickDecide has a random picker, coin flip, and pro/con lists to help you choose.', 'quickdecide', 'lifestyle', 55, true),
('Flip a coin for me', 'QuickDecide has a coin flip mode plus a random picker for multiple options.', 'quickdecide', 'lifestyle', 38, true);
