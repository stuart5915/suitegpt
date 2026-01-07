// Pre-cached template apps for instant loading
// These skip the Gemini API call entirely

export interface CachedApp {
    id: string;
    name: string;
    description: string;
    spec: {
        name: string;
        description: string;
        features: string[];
        screens: string[];
    };
    files: { path: string; content: string }[];
}

export const CACHED_TEMPLATES: Record<string, CachedApp> = {
    habit: {
        id: 'template-habit',
        name: 'HabitFlow',
        description: 'A habit tracking app with daily streaks, progress charts, and notifications.',
        spec: {
            name: 'HabitFlow',
            description: 'A habit tracking app with daily streaks, progress charts, and notifications.',
            features: [
                'Create and track daily habits',
                'Visual streak counter',
                'Progress charts and statistics',
                'Push notification reminders',
                'Categories for habits',
            ],
            screens: ['HomeScreen', 'HabitsScreen', 'StatsScreen', 'SettingsScreen'],
        },
        files: [
            { path: 'package.json', content: '{ "name": "habit-flow", "version": "1.0.0" }' },
            { path: 'app.json', content: '{ "expo": { "name": "HabitFlow" } }' },
            { path: 'App.tsx', content: 'export default function App() { return <View /> }' },
        ],
    },
    todo: {
        id: 'template-todo',
        name: 'TaskMaster',
        description: 'A simple todo list app with categories, due dates, and swipe to complete.',
        spec: {
            name: 'TaskMaster',
            description: 'A simple todo list app with categories, due dates, and swipe to complete.',
            features: [
                'Create tasks with title and description',
                'Categorize tasks (Work, Personal, etc.)',
                'Set due dates and reminders',
                'Swipe to complete tasks',
                'Filter and sort tasks',
            ],
            screens: ['HomeScreen', 'TaskListScreen', 'AddTaskScreen', 'SettingsScreen'],
        },
        files: [
            { path: 'package.json', content: '{ "name": "task-master", "version": "1.0.0" }' },
            { path: 'app.json', content: '{ "expo": { "name": "TaskMaster" } }' },
            { path: 'App.tsx', content: 'export default function App() { return <View /> }' },
        ],
    },
    notes: {
        id: 'template-notes',
        name: 'QuickNotes',
        description: 'A notes app with folders, search, and markdown support.',
        spec: {
            name: 'QuickNotes',
            description: 'A notes app with folders, search, and markdown support.',
            features: [
                'Create and edit notes',
                'Organize with folders',
                'Full-text search',
                'Markdown formatting',
                'Pin important notes',
            ],
            screens: ['HomeScreen', 'NotesListScreen', 'NoteEditorScreen', 'FoldersScreen'],
        },
        files: [
            { path: 'package.json', content: '{ "name": "quick-notes", "version": "1.0.0" }' },
            { path: 'app.json', content: '{ "expo": { "name": "QuickNotes" } }' },
            { path: 'App.tsx', content: 'export default function App() { return <View /> }' },
        ],
    },
    fitness: {
        id: 'template-fitness',
        name: 'FitTrack',
        description: 'A workout tracker with exercise library, workout plans, and progress photos.',
        spec: {
            name: 'FitTrack',
            description: 'A workout tracker with exercise library, workout plans, and progress photos.',
            features: [
                'Log workouts with sets and reps',
                'Exercise library with demos',
                'Create workout plans',
                'Track progress with photos',
                'View workout history',
            ],
            screens: ['HomeScreen', 'WorkoutsScreen', 'ExercisesScreen', 'ProfileScreen'],
        },
        files: [
            { path: 'package.json', content: '{ "name": "fit-track", "version": "1.0.0" }' },
            { path: 'app.json', content: '{ "expo": { "name": "FitTrack" } }' },
            { path: 'App.tsx', content: 'export default function App() { return <View /> }' },
        ],
    },
    budget: {
        id: 'template-budget',
        name: 'MoneyWise',
        description: 'An expense tracker with categories, monthly budgets, and spending charts.',
        spec: {
            name: 'MoneyWise',
            description: 'An expense tracker with categories, monthly budgets, and spending charts.',
            features: [
                'Track income and expenses',
                'Categorize transactions',
                'Set monthly budgets',
                'Spending analytics charts',
                'Export reports',
            ],
            screens: ['HomeScreen', 'TransactionsScreen', 'BudgetsScreen', 'StatsScreen'],
        },
        files: [
            { path: 'package.json', content: '{ "name": "money-wise", "version": "1.0.0" }' },
            { path: 'app.json', content: '{ "expo": { "name": "MoneyWise" } }' },
            { path: 'App.tsx', content: 'export default function App() { return <View /> }' },
        ],
    },
    recipe: {
        id: 'template-recipe',
        name: 'CookBook',
        description: 'A recipe app with meal planning, grocery lists, and cooking timers.',
        spec: {
            name: 'CookBook',
            description: 'A recipe app with meal planning, grocery lists, and cooking timers.',
            features: [
                'Browse and save recipes',
                'Weekly meal planning',
                'Auto-generate grocery lists',
                'Step-by-step cooking mode',
                'Built-in timers',
            ],
            screens: ['HomeScreen', 'RecipesScreen', 'MealPlanScreen', 'GroceryListScreen'],
        },
        files: [
            { path: 'package.json', content: '{ "name": "cook-book", "version": "1.0.0" }' },
            { path: 'app.json', content: '{ "expo": { "name": "CookBook" } }' },
            { path: 'App.tsx', content: 'export default function App() { return <View /> }' },
        ],
    },
};

export function getCachedTemplate(templateId: string): CachedApp | null {
    return CACHED_TEMPLATES[templateId] || null;
}
