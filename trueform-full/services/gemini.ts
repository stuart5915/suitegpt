import { GEMINI_API_KEY } from '../config/keys';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Health profile data for personalization
interface UserHealthProfile {
    weight_lbs?: number;
    height_inches?: number;
    birth_year?: number;
    activity_level?: 'sedentary' | 'light' | 'moderate' | 'active';
    medical_conditions?: string[];
    health_notes?: string;
}

interface PainPoint {
    timestamp_seconds: number;
    pose_snapshot: any;
    intensity: number;
    body_part: string;
}

interface PainContext {
    pain_areas: string[];
    pain_duration: string;
    pain_triggers: string[];
    goals: string[];
}

interface Exercise {
    name: string;
    description: string;
    sets?: number;
    reps?: number;
    duration_seconds?: number;
    frequency: string;
    difficulty: 'easy' | 'medium' | 'hard';
    target_area: string;
}

interface GeneratedPlan {
    exercises: Exercise[];
    frequency: string;
    duration_weeks: number;
    reasoning: string;
}

// Generate exercise plan based on scan and pain context
export const generateExercisePlan = async (
    painContext: PainContext,
    painPoints: PainPoint[],
    previousWorkoutCount?: number,
    previousPainLevels?: number[],
    healthProfile?: UserHealthProfile
): Promise<GeneratedPlan | null> => {
    const prompt = buildPlanPrompt(painContext, painPoints, previousWorkoutCount, previousPainLevels, healthProfile);

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
            }),
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('No response from Gemini');
            return null;
        }

        // Parse the JSON response
        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }

        // Try parsing the whole response as JSON
        return JSON.parse(text);
    } catch (error) {
        console.error('Error generating plan:', error);
        return null;
    }
};

// Generate progress feedback after a follow-up scan
export const generateProgressFeedback = async (
    painContext: PainContext,
    previousScanPainPoints: PainPoint[],
    currentScanPainPoints: PainPoint[],
    workoutCount: number,
    daysSinceLastScan: number
): Promise<string | null> => {
    const prompt = buildProgressPrompt(
        painContext,
        previousScanPainPoints,
        currentScanPainPoints,
        workoutCount,
        daysSinceLastScan
    );

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                },
            }),
        });

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
        console.error('Error generating feedback:', error);
        return null;
    }
};

// Build the prompt for plan generation
function buildPlanPrompt(
    painContext: PainContext,
    painPoints: PainPoint[],
    previousWorkoutCount?: number,
    previousPainLevels?: number[],
    healthProfile?: UserHealthProfile
): string {
    const painAreasStr = painContext.pain_areas.join(', ');
    const triggersStr = painContext.pain_triggers.join(', ');
    const goalsStr = painContext.goals.join(', ');

    const avgPainIntensity = painPoints.length > 0
        ? painPoints.reduce((sum, p) => sum + p.intensity, 0) / painPoints.length
        : 0;

    const bodyPartsAffected = [...new Set(painPoints.map(p => p.body_part))];

    let progressContext = '';
    if (previousWorkoutCount !== undefined) {
        progressContext = `
The user has completed ${previousWorkoutCount} workouts since their last plan.
${previousPainLevels ? `Their pain levels during workouts: ${previousPainLevels.join(', ')}` : ''}
`;
    }

    // Build health profile context
    let healthContext = '';
    if (healthProfile) {
        const currentYear = new Date().getFullYear();
        const age = healthProfile.birth_year ? currentYear - healthProfile.birth_year : null;
        const heightFeet = healthProfile.height_inches ? Math.floor(healthProfile.height_inches / 12) : null;
        const heightIn = healthProfile.height_inches ? healthProfile.height_inches % 12 : null;

        healthContext = `
## User Health Profile
${age ? `- Age: ${age} years old` : ''}
${healthProfile.weight_lbs ? `- Weight: ${healthProfile.weight_lbs} lbs` : ''}
${heightFeet !== null ? `- Height: ${heightFeet}'${heightIn}"` : ''}
${healthProfile.activity_level ? `- Activity Level: ${healthProfile.activity_level}` : ''}
${healthProfile.medical_conditions && healthProfile.medical_conditions.length > 0 ? `- Medical Conditions: ${healthProfile.medical_conditions.join(', ')}` : ''}
${healthProfile.health_notes ? `- Additional Notes: ${healthProfile.health_notes}` : ''}

IMPORTANT: Consider the above health profile when generating exercises. Adjust intensity based on age and activity level. Be cautious with any medical conditions mentioned.
`;
    }

    return `You are an expert physiotherapy AI assistant. Generate a personalized exercise plan based on the following information.
${healthContext}
## User's Pain Context
- Pain areas: ${painAreasStr}
- Duration of pain: ${painContext.pain_duration}
- Triggers: ${triggersStr}
- Goals: ${goalsStr}

## Movement Scan Results
- Number of pain points identified: ${painPoints.length}
- Average pain intensity (1-10): ${avgPainIntensity.toFixed(1)}
- Body parts affected during movement: ${bodyPartsAffected.join(', ')}
${progressContext}

## Instructions
Generate a safe, progressive exercise plan that:
1. Starts gently and builds up
2. Targets the affected areas
3. Avoids movements that triggered pain
4. Includes mobility, strengthening, and stretching exercises
5. Is appropriate for the user's age, weight, and activity level
6. Accounts for any medical conditions mentioned

Respond ONLY with valid JSON in this exact format:
\`\`\`json
{
  "exercises": [
    {
      "name": "Exercise Name",
      "description": "Clear step-by-step instructions",
      "sets": 3,
      "reps": 10,
      "duration_seconds": null,
      "frequency": "daily",
      "difficulty": "easy",
      "target_area": "shoulder"
    }
  ],
  "frequency": "daily",
  "duration_weeks": 2,
  "reasoning": "Brief explanation of why this plan was chosen"
}
\`\`\``;
}

// Build the prompt for progress feedback
function buildProgressPrompt(
    painContext: PainContext,
    previousPainPoints: PainPoint[],
    currentPainPoints: PainPoint[],
    workoutCount: number,
    daysSinceLastScan: number
): string {
    const prevAvgIntensity = previousPainPoints.length > 0
        ? previousPainPoints.reduce((sum, p) => sum + p.intensity, 0) / previousPainPoints.length
        : 0;

    const currAvgIntensity = currentPainPoints.length > 0
        ? currentPainPoints.reduce((sum, p) => sum + p.intensity, 0) / currentPainPoints.length
        : 0;

    const improvement = prevAvgIntensity - currAvgIntensity;

    return `You are an encouraging physiotherapy AI assistant. Provide progress feedback to the user.

## Context
- Pain areas: ${painContext.pain_areas.join(', ')}
- Goals: ${painContext.goals.join(', ')}

## Progress Data
- Days since last scan: ${daysSinceLastScan}
- Workouts completed: ${workoutCount}
- Previous scan: ${previousPainPoints.length} pain points, avg intensity ${prevAvgIntensity.toFixed(1)}
- Current scan: ${currentPainPoints.length} pain points, avg intensity ${currAvgIntensity.toFixed(1)}
- Change in average pain: ${improvement > 0 ? `Improved by ${improvement.toFixed(1)} points! 🎉` : improvement < 0 ? `Increased by ${Math.abs(improvement).toFixed(1)} points` : 'No change'}

## Instructions
Provide encouraging, personalized feedback that:
1. Acknowledges their effort (${workoutCount} workouts)
2. Highlights improvements or addresses setbacks
3. Suggests next steps
4. Stays positive and motivating

Keep the response conversational and under 150 words.`;
}
