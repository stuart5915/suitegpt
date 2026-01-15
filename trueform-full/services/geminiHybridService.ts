import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
// import * as FileSystem from 'expo-file-system'; // Deprecated method causes error
// import { readAsStringAsync } from 'expo-file-system'; // Try standard first, or legacy if needed. 
// ERROR says: "import the legacy API from 'expo-file-system/legacy'"
// Let's interpret 'expo-file-system/legacy' might not be available in types yet, so we cast or try direct.
// Actually, the error is explicit.

import { readAsStringAsync as readAsStringAsyncLegacy } from 'expo-file-system/legacy';

// NOTE: In production, API key should be in .env or fetched from backend
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const genAI = new GoogleGenerativeAI(API_KEY);

// Safety settings to allow physiotherapy/medical movement analysis
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];
export interface UserHealthProfile {
    weight_lbs?: number;
    height_inches?: number;
    birth_year?: number;
    activity_level?: 'sedentary' | 'light' | 'moderate' | 'active';
    medical_conditions?: string[];
    health_notes?: string;
}

interface AnalysisInput {
    movementName: string;
    duration: number;
    poseData: any[]; // Sampled frames of pose data
    visualFrames: string[]; // Local file URIs of captured images
}

export type AnalysisTier = 'standard' | 'advanced';

export interface AIAnalysisResult {
    mobilityScore: number;
    summary: string;
    keyIssues: {
        bodyPart: string;
        issue: string;
        severity: 'low' | 'medium' | 'high';
    }[];
    visualObservations: string[]; // Things seen in video distinct from pose data
    recommendation: string;
}

// Convert local file URI to Base64
async function fileToGenerativePart(uri: string, mimeType: string) {
    // legacy readAsStringAsync avoids the error check
    const base64 = await readAsStringAsyncLegacy(uri, {
        encoding: 'base64',
    });
    return {
        inlineData: {
            data: base64,
            mimeType,
        },
    };
}

export const analyzeMovementHybrid = async (
    input: AnalysisInput,
    tier: AnalysisTier = 'standard',
    healthProfile?: UserHealthProfile
): Promise<AIAnalysisResult> => {
    try {
        // 1. Select Model
        const modelName = tier === 'advanced' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" },
            safetySettings,
        });

        console.log(`🧠 Starting Hybrid Analysis with ${modelName}...`);

        // 2. Prepare Visual Evidence
        // Limit to 5 frames to manage payload size/latency
        let imageParts: any[] = [];
        if (input.visualFrames && input.visualFrames.length > 0) {
            const frameLimit = 5;
            const selectedFrames = input.visualFrames.filter((_, i) =>
                i % Math.ceil(input.visualFrames.length / frameLimit) === 0
            ).slice(0, frameLimit);

            imageParts = await Promise.all(
                selectedFrames.map(uri => fileToGenerativePart(uri, 'image/jpeg'))
            );
        }

        // 3. Prepare Quantitative Context
        const dataSummary = JSON.stringify({
            movement: input.movementName,
            duration: input.duration,
            poseSample: input.poseData.slice(0, 5), // Just a sample for context, not full array
        });

        // 4. Build health profile context if available
        let healthContext = '';
        if (healthProfile) {
            const currentYear = new Date().getFullYear();
            const age = healthProfile.birth_year ? currentYear - healthProfile.birth_year : null;
            const heightFeet = healthProfile.height_inches ? Math.floor(healthProfile.height_inches / 12) : null;
            const heightIn = healthProfile.height_inches ? healthProfile.height_inches % 12 : null;

            const profileParts = [];
            if (age) profileParts.push(`Age: ${age} years`);
            if (healthProfile.weight_lbs) profileParts.push(`Weight: ${healthProfile.weight_lbs} lbs`);
            if (heightFeet !== null) profileParts.push(`Height: ${heightFeet}'${heightIn}"`);
            if (healthProfile.activity_level) profileParts.push(`Activity level: ${healthProfile.activity_level}`);
            if (healthProfile.medical_conditions && healthProfile.medical_conditions.length > 0) {
                profileParts.push(`Medical conditions: ${healthProfile.medical_conditions.join(', ')}`);
            }
            if (healthProfile.health_notes) profileParts.push(`Notes: ${healthProfile.health_notes}`);

            if (profileParts.length > 0) {
                healthContext = `
            User Health Profile:
            ${profileParts.join('\n            ')}
            
            IMPORTANT: Consider the user's health profile when making recommendations. Be cautious with any medical conditions mentioned and adjust advice for their age and activity level.
`;
            }
        }

        // 5. Construct Prompt
        const prompt = `
            Role: Elite Physiotherapist & Biomechanics Expert.
            Task: Analyze this user's ${input.movementName} movement for injury risk and form quality.

            Context:
            - You are provided with keyframe images of the user performing the movement.
            - You are provided with basic pose text data: ${dataSummary}
${healthContext}
            Analysis Instructions:
            1. OBSERVE the images closely. Look for "cheating" movements, facial expressions of effort/pain, spinal alignment, and joint tracking.
            2. COMPARE against ideal biomechanics for ${input.movementName}.
            3. IGNORE the overlay skeleton if it looks glitchy; trust the visual human form.
            4. CONSIDER the user's health profile when making recommendations.

            Output JSON Format:
            {
                "mobilityScore": number (0-100, where 100 is perfect form),
                "summary": "1-2 sentence friendly professional summary",
                "keyIssues": [
                    { "bodyPart": "Right Shoulder", "issue": "Shrugging during lift (Upper Trap dominance)", "severity": "medium" }
                ],
                "visualObservations": ["Grimacing at top of movement", "Arched lower back"],
                "recommendation": "Specific actionable advice tailored to the user's health profile"
            }
        `;

        // 5. Generate
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        console.log('🧠 AI Analysis Complete');
        return JSON.parse(text) as AIAnalysisResult;

    } catch (error) {
        console.error('Hybrid Analysis Failed:', error);
        // Fallback or rethrow
        throw error;
    }
};

// Helper function to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
};

// Simple wrapper for review screen - just frames + prompt → text report
export const analyzeFramesWithPrompt = async (
    frameURIs: string[],
    customPrompt: string
): Promise<string> => {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            safetySettings,
        });
        console.log(`🧠 Analyzing ${frameURIs.length} frames...`);

        // Convert first 10 frames to image parts (limit for token/cost)
        const frameLimit = Math.min(10, frameURIs.length);
        const selectedFrames = frameURIs.slice(0, frameLimit);

        console.log(`🧠 Converting ${selectedFrames.length} frames to base64...`);
        const imageParts = await Promise.all(
            selectedFrames.map(uri => fileToGenerativePart(uri, 'image/jpeg'))
        );

        console.log(`🧠 Sending ${imageParts.length} images to Gemini...`);

        // Generate with custom prompt - add 60 second timeout
        const result = await withTimeout(
            model.generateContent([customPrompt, ...imageParts]),
            60000,
            'AI analysis timed out after 60 seconds. Please try again with fewer frames or check your internet connection.'
        );
        const response = await result.response;
        const text = response.text();

        console.log('✅ Analysis complete');
        return text;

    } catch (error: any) {
        console.error('❌ Frame Analysis Failed:', error);
        throw error;
    }
};
