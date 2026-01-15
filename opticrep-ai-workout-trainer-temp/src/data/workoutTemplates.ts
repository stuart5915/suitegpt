import { WorkoutDay } from '../types/workout';

// ============ TYPES ============
export interface WorkoutTemplate {
    id: string;
    name: string;
    emoji: string;
    description: string;
    targetAudience: string;
    daysPerWeek: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    tags: string[];
    days: WorkoutDay[];
}

// ============ HELPER ============
const createExercise = (name: string, workingSets: number, reps: string) => ({
    id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    sets: Array(workingSets).fill(null).map(() => ({
        type: 'working' as const,
        groupId: 'main',
        reps,
    })),
});

// ============ TEMPLATES ============

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
    // ==========================================
    // 1. STRENGTH & HYPERTROPHY (Push/Pull/Legs)
    // ==========================================
    {
        id: 'strength-ppl',
        name: 'Strength & Hypertrophy',
        emoji: '🏋️',
        description: 'Classic Push/Pull/Legs split for muscle growth and strength gains',
        targetAudience: 'Adults 18-55 seeking muscle building',
        daysPerWeek: 6,
        difficulty: 'intermediate',
        tags: ['muscle', 'strength', 'bodybuilding'],
        days: [
            {
                name: 'Push A',
                dayOfWeek: 'Monday',
                isRestDay: false,
                exercises: [
                    createExercise('Barbell Bench Press', 4, '6-8'),
                    createExercise('Overhead Press', 3, '8-10'),
                    createExercise('Incline Dumbbell Press', 3, '10-12'),
                    createExercise('Lateral Raises', 3, '12-15'),
                    createExercise('Tricep Pushdowns', 3, '12-15'),
                    createExercise('Overhead Tricep Extension', 3, '12-15'),
                ],
            },
            {
                name: 'Pull A',
                dayOfWeek: 'Tuesday',
                isRestDay: false,
                exercises: [
                    createExercise('Barbell Rows', 4, '6-8'),
                    createExercise('Weighted Pull-ups', 3, '6-10'),
                    createExercise('Seated Cable Rows', 3, '10-12'),
                    createExercise('Face Pulls', 3, '15-20'),
                    createExercise('Barbell Curls', 3, '10-12'),
                    createExercise('Hammer Curls', 3, '12-15'),
                ],
            },
            {
                name: 'Legs A',
                dayOfWeek: 'Wednesday',
                isRestDay: false,
                exercises: [
                    createExercise('Barbell Squats', 4, '6-8'),
                    createExercise('Romanian Deadlifts', 3, '8-10'),
                    createExercise('Leg Press', 3, '10-12'),
                    createExercise('Leg Curls', 3, '12-15'),
                    createExercise('Calf Raises', 4, '15-20'),
                ],
            },
            {
                name: 'Push B',
                dayOfWeek: 'Thursday',
                isRestDay: false,
                exercises: [
                    createExercise('Dumbbell Bench Press', 4, '8-10'),
                    createExercise('Arnold Press', 3, '10-12'),
                    createExercise('Cable Flyes', 3, '12-15'),
                    createExercise('Rear Delt Flyes', 3, '15-20'),
                    createExercise('Skull Crushers', 3, '10-12'),
                    createExercise('Diamond Push-ups', 2, '15-20'),
                ],
            },
            {
                name: 'Pull B',
                dayOfWeek: 'Friday',
                isRestDay: false,
                exercises: [
                    createExercise('Deadlifts', 4, '5-6'),
                    createExercise('Lat Pulldowns', 3, '10-12'),
                    createExercise('Chest Supported Rows', 3, '10-12'),
                    createExercise('Shrugs', 3, '12-15'),
                    createExercise('Incline Curls', 3, '10-12'),
                    createExercise('Reverse Curls', 3, '12-15'),
                ],
            },
            {
                name: 'Legs B',
                dayOfWeek: 'Saturday',
                isRestDay: false,
                exercises: [
                    createExercise('Front Squats', 4, '8-10'),
                    createExercise('Bulgarian Split Squats', 3, '10-12'),
                    createExercise('Leg Extensions', 3, '12-15'),
                    createExercise('Lying Leg Curls', 3, '12-15'),
                    createExercise('Seated Calf Raises', 4, '15-20'),
                ],
            },
        ],
    },

    // ==========================================
    // 2. GENERAL FITNESS (3-Day Full Body)
    // ==========================================
    {
        id: 'general-fitness',
        name: 'General Fitness',
        emoji: '🏃',
        description: '3-day full-body routine for overall health and fitness',
        targetAudience: 'Busy adults seeking balanced fitness',
        daysPerWeek: 3,
        difficulty: 'beginner',
        tags: ['health', 'full-body', 'balanced'],
        days: [
            {
                name: 'Full Body A',
                dayOfWeek: 'Monday',
                isRestDay: false,
                exercises: [
                    createExercise('Goblet Squats', 3, '12-15'),
                    createExercise('Dumbbell Bench Press', 3, '10-12'),
                    createExercise('Dumbbell Rows', 3, '10-12'),
                    createExercise('Lunges', 2, '12 each'),
                    createExercise('Plank', 3, '30-45s'),
                ],
            },
            {
                name: 'Full Body B',
                dayOfWeek: 'Wednesday',
                isRestDay: false,
                exercises: [
                    createExercise('Romanian Deadlifts', 3, '10-12'),
                    createExercise('Push-ups', 3, '10-15'),
                    createExercise('Lat Pulldowns', 3, '10-12'),
                    createExercise('Step-ups', 2, '12 each'),
                    createExercise('Dead Bug', 3, '10 each'),
                ],
            },
            {
                name: 'Full Body C',
                dayOfWeek: 'Friday',
                isRestDay: false,
                exercises: [
                    createExercise('Leg Press', 3, '12-15'),
                    createExercise('Incline Dumbbell Press', 3, '10-12'),
                    createExercise('Seated Cable Rows', 3, '10-12'),
                    createExercise('Glute Bridges', 3, '15-20'),
                    createExercise('Bicycle Crunches', 3, '15 each'),
                ],
            },
        ],
    },

    // ==========================================
    // 3. MOBILITY & FLEXIBILITY
    // ==========================================
    {
        id: 'mobility',
        name: 'Mobility & Flexibility',
        emoji: '🧘',
        description: 'Daily mobility routine for joint health and flexibility',
        targetAudience: 'Office workers, recovery focus, injury prevention',
        daysPerWeek: 4,
        difficulty: 'beginner',
        tags: ['mobility', 'flexibility', 'recovery'],
        days: [
            {
                name: 'Upper Body Mobility',
                dayOfWeek: 'Monday',
                isRestDay: false,
                exercises: [
                    createExercise('Shoulder Circles', 2, '10 each'),
                    createExercise('Arm Swings', 2, '15'),
                    createExercise('Cat-Cow Stretch', 2, '10'),
                    createExercise('Thread the Needle', 2, '8 each'),
                    createExercise('Thoracic Rotations', 2, '10 each'),
                    createExercise('Wall Angels', 2, '10'),
                    createExercise('Neck Rolls', 2, '5 each'),
                ],
            },
            {
                name: 'Lower Body Mobility',
                dayOfWeek: 'Tuesday',
                isRestDay: false,
                exercises: [
                    createExercise('Hip Circles', 2, '10 each'),
                    createExercise('Leg Swings', 2, '15 each'),
                    createExercise('Deep Squat Hold', 2, '30s'),
                    createExercise('90/90 Hip Stretch', 2, '30s each'),
                    createExercise('Pigeon Pose', 2, '30s each'),
                    createExercise('Ankle Circles', 2, '10 each'),
                    createExercise('Calf Stretch', 2, '30s each'),
                ],
            },
            {
                name: 'Full Body Flow',
                dayOfWeek: 'Thursday',
                isRestDay: false,
                exercises: [
                    createExercise("World's Greatest Stretch", 2, '5 each'),
                    createExercise('Downward Dog to Cobra', 2, '8'),
                    createExercise('Hip Flexor Stretch', 2, '30s each'),
                    createExercise('Chest Opener', 2, '30s'),
                    createExercise('Spinal Twist', 2, '30s each'),
                    createExercise('Child\'s Pose', 2, '45s'),
                ],
            },
            {
                name: 'Active Recovery',
                dayOfWeek: 'Saturday',
                isRestDay: false,
                exercises: [
                    createExercise('Foam Roll - Back', 1, '60s'),
                    createExercise('Foam Roll - Quads', 1, '60s each'),
                    createExercise('Foam Roll - IT Band', 1, '60s each'),
                    createExercise('Foam Roll - Glutes', 1, '60s each'),
                    createExercise('Lacrosse Ball - Shoulders', 1, '60s each'),
                    createExercise('Gentle Stretching', 1, '5 min'),
                ],
            },
        ],
    },

    // ==========================================
    // 4. ATHLETIC POWER & PLYOMETRICS
    // ==========================================
    {
        id: 'athletic-power',
        name: 'Athletic Power',
        emoji: '⚡',
        description: 'Explosive training for sports performance and power',
        targetAudience: 'Athletes, ages 16-40, sports performance',
        daysPerWeek: 3,
        difficulty: 'advanced',
        tags: ['power', 'explosive', 'athletic'],
        days: [
            {
                name: 'Lower Power',
                dayOfWeek: 'Monday',
                isRestDay: false,
                exercises: [
                    createExercise('Box Jumps', 4, '5'),
                    createExercise('Power Cleans', 4, '3-5'),
                    createExercise('Jump Squats', 3, '6'),
                    createExercise('Broad Jumps', 3, '5'),
                    createExercise('Single Leg Hops', 3, '6 each'),
                    createExercise('Depth Jumps', 3, '4'),
                ],
            },
            {
                name: 'Upper Power',
                dayOfWeek: 'Wednesday',
                isRestDay: false,
                exercises: [
                    createExercise('Medicine Ball Chest Pass', 4, '6'),
                    createExercise('Plyometric Push-ups', 4, '5'),
                    createExercise('Medicine Ball Slams', 3, '8'),
                    createExercise('Overhead Medicine Ball Throw', 3, '6'),
                    createExercise('Battle Ropes', 3, '20s'),
                    createExercise('Explosive Pull-ups', 3, '5'),
                ],
            },
            {
                name: 'Full Body Explosiveness',
                dayOfWeek: 'Friday',
                isRestDay: false,
                exercises: [
                    createExercise('Clean and Press', 4, '3'),
                    createExercise('Burpees', 3, '8'),
                    createExercise('Tuck Jumps', 3, '6'),
                    createExercise('Lateral Bounds', 3, '6 each'),
                    createExercise('Rotational Medicine Ball Throw', 3, '6 each'),
                    createExercise('Sprint Intervals', 4, '10s'),
                ],
            },
        ],
    },

    // ==========================================
    // 5. ACTIVE AGING / LOW IMPACT
    // ==========================================
    {
        id: 'active-aging',
        name: 'Active Aging',
        emoji: '👴',
        description: 'Low-impact routine for adults 55+ with balance focus',
        targetAudience: 'Adults 55+, joint issues, fall prevention',
        daysPerWeek: 3,
        difficulty: 'beginner',
        tags: ['senior', 'low-impact', 'balance'],
        days: [
            {
                name: 'Strength & Balance A',
                dayOfWeek: 'Monday',
                isRestDay: false,
                exercises: [
                    createExercise('Chair Squats', 2, '10-12'),
                    createExercise('Wall Push-ups', 2, '10-12'),
                    createExercise('Seated Rows (Band)', 2, '12-15'),
                    createExercise('Single Leg Stand', 2, '30s each'),
                    createExercise('Heel-to-Toe Walk', 2, '10 steps'),
                    createExercise('Seated Marching', 2, '20'),
                ],
            },
            {
                name: 'Strength & Balance B',
                dayOfWeek: 'Wednesday',
                isRestDay: false,
                exercises: [
                    createExercise('Step-ups (Low Step)', 2, '10 each'),
                    createExercise('Seated Shoulder Press', 2, '12-15'),
                    createExercise('Seated Bicep Curls', 2, '12-15'),
                    createExercise('Heel Raises (Chair Support)', 2, '15-20'),
                    createExercise('Side Leg Raises (Chair Support)', 2, '10 each'),
                    createExercise('Tandem Stand', 2, '30s each'),
                ],
            },
            {
                name: 'Flexibility & Core',
                dayOfWeek: 'Friday',
                isRestDay: false,
                exercises: [
                    createExercise('Seated Spinal Twist', 2, '30s each'),
                    createExercise('Seated Hamstring Stretch', 2, '30s each'),
                    createExercise('Seated Cat-Cow', 2, '10'),
                    createExercise('Seated Abdominal Bracing', 2, '10'),
                    createExercise('Shoulder Rolls', 2, '10 each'),
                    createExercise('Deep Breathing', 2, '5 breaths'),
                ],
            },
        ],
    },

    // ==========================================
    // 6. BEGINNER FULL BODY
    // ==========================================
    {
        id: 'beginner',
        name: 'Beginner Full Body',
        emoji: '🌱',
        description: 'Simple routine for complete beginners to build foundation',
        targetAudience: 'Complete beginners, returning after long break',
        daysPerWeek: 3,
        difficulty: 'beginner',
        tags: ['beginner', 'foundation', 'simple'],
        days: [
            {
                name: 'Workout A',
                dayOfWeek: 'Monday',
                isRestDay: false,
                exercises: [
                    createExercise('Bodyweight Squats', 2, '12-15'),
                    createExercise('Push-ups (or Knee Push-ups)', 2, '8-12'),
                    createExercise('Dumbbell Rows', 2, '10-12'),
                    createExercise('Glute Bridges', 2, '15'),
                    createExercise('Plank', 2, '20-30s'),
                ],
            },
            {
                name: 'Workout B',
                dayOfWeek: 'Wednesday',
                isRestDay: false,
                exercises: [
                    createExercise('Goblet Squats', 2, '10-12'),
                    createExercise('Incline Push-ups', 2, '10-12'),
                    createExercise('Lat Pulldowns', 2, '10-12'),
                    createExercise('Lunges', 2, '8 each'),
                    createExercise('Dead Bug', 2, '8 each'),
                ],
            },
            {
                name: 'Workout C',
                dayOfWeek: 'Friday',
                isRestDay: false,
                exercises: [
                    createExercise('Leg Press', 2, '12-15'),
                    createExercise('Dumbbell Chest Press', 2, '10-12'),
                    createExercise('Seated Cable Rows', 2, '10-12'),
                    createExercise('Step-ups', 2, '10 each'),
                    createExercise('Bird Dog', 2, '8 each'),
                ],
            },
        ],
    },
];

export default WORKOUT_TEMPLATES;
