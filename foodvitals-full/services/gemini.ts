import { GEMINI_API_KEY, GEMINI_MODELS, GeminiModel } from '../config/keys';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ============================================
// TYPES
// ============================================

export interface ParsedFoodItem {
    name: string;
    quantity: number;
    unit: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    // Micronutrients
    vitamin_c_mg?: number;
    vitamin_d_mcg?: number;
    calcium_mg?: number;
    iron_mg?: number;
    potassium_mg?: number;
    sodium_mg?: number;
}

export interface ParsedMeal {
    items: ParsedFoodItem[];
    totals: {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g?: number;
        // Micronutrient totals
        vitamin_c_mg?: number;
        vitamin_d_mcg?: number;
        calcium_mg?: number;
        iron_mg?: number;
        potassium_mg?: number;
        sodium_mg?: number;
    };
    confidence: number;
    notes?: string;
}

// ============================================
// FOOD PARSING
// ============================================

/**
 * Parse natural language food input into structured nutrition data
 * Example: "3 eggs, 1 slice sourdough, 200g egg whites"
 */
export const parseFoodInput = async (
    input: string,
    model: GeminiModel = GEMINI_MODELS.FLASH
): Promise<ParsedMeal | null> => {
    const prompt = buildFoodParsingPrompt(input);

    try {
        const response = await fetch(
            `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3, // Low for accuracy
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    },
                }),
            }
        );

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
        console.error('Error parsing food:', error);
        return null;
    }
};

/**
 * Analyze a food photo and extract nutrition info
 */
export const analyzeFoodPhoto = async (
    base64Image: string,
    additionalContext?: string,
    model: GeminiModel = GEMINI_MODELS.FLASH
): Promise<ParsedMeal | null> => {
    const prompt = buildPhotoAnalysisPrompt(additionalContext);

    try {
        const response = await fetch(
            `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: 'image/jpeg',
                                        data: base64Image,
                                    },
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 4096,
                        responseMimeType: 'application/json', // Force JSON output
                    },
                }),
            }
        );

        const data = await response.json();

        if (data.error) {
            console.error('Gemini API error:', data.error);
            return null;
        }

        // Log finish reason for debugging
        const finishReason = data.candidates?.[0]?.finishReason;
        console.log('Finish reason:', finishReason);

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('No response from Gemini. Full response:', JSON.stringify(data, null, 2));
            return null;
        }

        console.log('Gemini response length:', text.length);
        console.log('Gemini full response:', text);

        // Clean the text and extract JSON
        try {
            let jsonStr = text;

            // Remove markdown code block wrapper if present
            // Handle ```json ... ``` format
            if (jsonStr.includes('```json')) {
                const start = jsonStr.indexOf('```json') + 7;
                const end = jsonStr.lastIndexOf('```');
                if (end > start) {
                    jsonStr = jsonStr.substring(start, end);
                }
            }
            // Handle ``` ... ``` format
            else if (jsonStr.includes('```')) {
                const start = jsonStr.indexOf('```') + 3;
                const end = jsonStr.lastIndexOf('```');
                if (end > start) {
                    jsonStr = jsonStr.substring(start, end);
                }
            }

            // Trim whitespace and newlines
            jsonStr = jsonStr.trim();

            // If still doesn't look like JSON, try to extract object
            if (!jsonStr.startsWith('{')) {
                const objStart = jsonStr.indexOf('{');
                const objEnd = jsonStr.lastIndexOf('}');
                if (objStart !== -1 && objEnd > objStart) {
                    jsonStr = jsonStr.substring(objStart, objEnd + 1);
                }
            }

            console.log('Extracted JSON preview:', jsonStr.substring(0, 200));

            const parsed = JSON.parse(jsonStr);
            return parsed;
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Raw text was:', text);
            return null;
        }
    } catch (error) {
        console.error('Error analyzing photo:', error);
        return null;
    }
};

// ============================================
// INSIGHTS & RECOMMENDATIONS
// ============================================

export interface WeeklyInsight {
    summary: string;
    avgCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFat: number;
    missingNutrients: string[];
    recommendations: Array<{
        suggestion: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
    }>;
    achievements: string[];
}

/**
 * Generate weekly nutrition insights and recommendations
 */
export const generateWeeklyInsights = async (
    weeklyData: {
        dailySummaries: Array<{
            date: string;
            calories: number;
            protein_g: number;
            carbs_g: number;
            fat_g: number;
            fiber_g: number;
            vitamin_c_mg: number;
            vitamin_d_mcg: number;
            calcium_mg: number;
            iron_mg: number;
            potassium_mg: number;
            sodium_mg: number;
        }>;
        goals: {
            target_calories: number;
            target_protein_g: number;
            target_carbs_g: number;
            target_fat_g: number;
            target_fiber_g: number;
        };
    },
    model: GeminiModel = GEMINI_MODELS.FLASH
): Promise<WeeklyInsight | null> => {
    const prompt = buildInsightsPrompt(weeklyData);

    try {
        const response = await fetch(
            `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                    },
                }),
            }
        );

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }

        return JSON.parse(text);
    } catch (error) {
        console.error('Error generating insights:', error);
        return null;
    }
};

// ============================================
// PROMPT BUILDERS
// ============================================

function buildFoodParsingPrompt(input: string): string {
    return `You are a nutrition AI assistant. Parse the following food description and provide detailed nutrition information.

## User Input
"${input}"

## Instructions
1. Identify each food item with quantity and unit
2. Estimate calories and macros based on USDA nutrition data
3. Include basic micronutrients (Vitamin C, D, Calcium, Iron, Potassium, Sodium)
4. Be accurate - when uncertain, provide conservative estimates
5. Set confidence 0-1 based on how certain you are

## Response Format
Respond ONLY with valid JSON:
\`\`\`json
{
  "items": [
    {
      "name": "egg",
      "quantity": 3,
      "unit": "whole",
      "calories": 210,
      "protein_g": 18.6,
      "carbs_g": 1.1,
      "fat_g": 14.3,
      "fiber_g": 0,
      "vitamin_c_mg": 0,
      "vitamin_d_mcg": 3.1,
      "calcium_mg": 84,
      "iron_mg": 2.6,
      "potassium_mg": 201,
      "sodium_mg": 213
    }
  ],
  "totals": {
    "calories": 210,
    "protein_g": 18.6,
    "carbs_g": 1.1,
    "fat_g": 14.3,
    "fiber_g": 0,
    "vitamin_c_mg": 0,
    "vitamin_d_mcg": 3.1,
    "calcium_mg": 84,
    "iron_mg": 2.6,
    "potassium_mg": 201,
    "sodium_mg": 213
  },
  "confidence": 0.9,
  "notes": "Optional notes about the estimation"
}
\`\`\``;
}

function buildPhotoAnalysisPrompt(additionalContext?: string): string {
    return `Analyze this food photo and estimate nutrition.
${additionalContext ? `Context: ${additionalContext}` : ''}

Identify each food item, estimate portion size, and provide nutrition per item.
Include micronutrients: vitamin_c_mg, vitamin_d_mcg, calcium_mg, iron_mg, potassium_mg, sodium_mg.

IMPORTANT for "notes" field: Provide a SHORT, CONCISE meal title (max 5-6 words). Just list the main foods, no fluff.
- GOOD: "Chicken, Rice & Broccoli" or "Mac & Cheese" or "Eggs, Toast & Bacon"
- BAD: "A balanced meal featuring grilled chicken with rice and vegetables"

Respond ONLY with this JSON format (no other text):
{"items":[{"name":"food","quantity":1,"unit":"oz","calories":100,"protein_g":10,"carbs_g":5,"fat_g":3,"fiber_g":1,"vitamin_c_mg":5,"vitamin_d_mcg":0,"calcium_mg":20,"iron_mg":1,"potassium_mg":100,"sodium_mg":50}],"totals":{"calories":100,"protein_g":10,"carbs_g":5,"fat_g":3,"fiber_g":1,"vitamin_c_mg":5,"vitamin_d_mcg":0,"calcium_mg":20,"iron_mg":1,"potassium_mg":100,"sodium_mg":50},"confidence":0.8,"notes":"Chicken, Rice & Broccoli"}`;
}

function buildInsightsPrompt(weeklyData: any): string {
    const { dailySummaries, goals } = weeklyData;

    const avgCalories = dailySummaries.reduce((sum: number, d: any) => sum + d.calories, 0) / dailySummaries.length;
    const avgProtein = dailySummaries.reduce((sum: number, d: any) => sum + d.protein_g, 0) / dailySummaries.length;

    return `You are a friendly nutrition coach AI. Analyze this week's nutrition data and provide helpful insights.

## User's Goals
- Target calories: ${goals.target_calories}/day
- Target protein: ${goals.target_protein_g}g/day
- Target carbs: ${goals.target_carbs_g}g/day
- Target fat: ${goals.target_fat_g}g/day
- Target fiber: ${goals.target_fiber_g}g/day

## This Week's Data
${JSON.stringify(dailySummaries, null, 2)}

## Instructions
1. Calculate averages and compare to goals
2. Identify nutrients that are consistently low
3. Provide 2-3 actionable food suggestions
4. Note any positive patterns or achievements
5. Keep tone encouraging and supportive

## Response Format
\`\`\`json
{
  "summary": "Brief 1-2 sentence overview of the week",
  "avgCalories": ${Math.round(avgCalories)},
  "avgProtein": ${Math.round(avgProtein)},
  "avgCarbs": 0,
  "avgFat": 0,
  "missingNutrients": ["Vitamin D", "Fiber"],
  "recommendations": [
    {
      "suggestion": "Add Greek yogurt to breakfast",
      "reason": "Great source of protein and calcium",
      "priority": "high"
    }
  ],
  "achievements": ["Hit protein goal 5/7 days!", "Consistent logging 🎉"]
}
\`\`\``;
}

// ============================================
// INSIGHTS AI FUNCTIONS
// ============================================

export interface NutritionContext {
    userProfile?: {
        age?: number;
        gender?: 'male' | 'female';
        weight_kg?: number;
        weight_unit?: 'kg' | 'lb';
        goal_type?: 'weight_loss' | 'weight_gain' | 'maintain';
    };
    goals: {
        target_calories: number;
        target_protein_g: number;
        target_carbs_g: number;
        target_fat_g: number;
        target_fiber_g?: number;
    } | null;
    todayTotals: {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g?: number;
    } | null;
    recentMeals: Array<{
        date: string;
        title: string;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
    }>;
}

/**
 * Generate a quick 1-2 sentence insight for the Home card
 */
export const generateQuickInsight = async (
    context: NutritionContext,
    model: GeminiModel = GEMINI_MODELS.FLASH
): Promise<string> => {
    const prompt = buildQuickInsightPrompt(context);

    try {
        const response = await fetch(
            `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 400, // Increased to prevent truncation
                    },
                }),
            }
        );

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        let cleaned = text?.trim();

        // Validate response
        if (!cleaned || cleaned.length < 10) {
            console.warn('Quick Insight too short:', cleaned);
            return "You may be low on fiber - try adding vegetables, beans, or whole grains to your meals.";
        }

        // Check for truncation (ends with comma, 'which', 'and', 'but', 'or', 'that', incomplete words)
        const truncationPatterns = /,\s*$|which\s*$|and\s*$|but\s*$|or\s*$|that\s*$|to\s*$/i;
        if (truncationPatterns.test(cleaned)) {
            console.warn('Quick Insight truncated, using fallback:', cleaned);
            return "Consider adding more variety to your meals - different colored vegetables provide different nutrients.";
        }

        // Auto-complete punctuation if missing
        if (!/[.!?]$/.test(cleaned)) {
            cleaned = cleaned + '.';
        }

        return cleaned;
    } catch (error) {
        console.error('Error generating quick insight:', error);
        return "Try adding leafy greens or nuts to boost your micronutrient intake.";
    }
};

/**
 * Chat with the Insights AI - full conversation response
 */
export const chatWithInsights = async (
    message: string,
    context: NutritionContext,
    model: GeminiModel = GEMINI_MODELS.FLASH
): Promise<string> => {
    const prompt = buildInsightsChatPrompt(message, context);

    try {
        const response = await fetch(
            `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 4096,
                    },
                }),
            }
        );

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return text?.trim() || "I couldn't generate a response. Please try again!";
    } catch (error) {
        console.error('Error in insights chat:', error);
        return "Something went wrong. Please try again!";
    }
};

function buildQuickInsightPrompt(context: NutritionContext): string {
    const { goals, todayTotals, recentMeals } = context;

    return `You are a nutrition health advisor. Generate ONE actionable concern or gap based on this user's data. Focus on what's MISSING or LOW, not what's going well.

USER'S GOALS:
${goals ? `- Target: ${goals.target_calories} cal, ${goals.target_protein_g}g protein, ${goals.target_carbs_g}g carbs, ${goals.target_fat_g}g fat` : 'No goals set yet'}

TODAY'S PROGRESS:
${todayTotals ? `- Eaten: ${todayTotals.calories} cal, ${Math.round(todayTotals.protein_g)}g protein, ${Math.round(todayTotals.carbs_g)}g carbs, ${Math.round(todayTotals.fat_g)}g fat` : 'No meals logged today'}

RECENT MEALS (last 7 days):
${recentMeals.length > 0 ? recentMeals.slice(0, 10).map(m => `- ${m.date}: ${m.title} (${m.calories} cal)`).join('\n') : 'No recent meals'}

FORMAT:
Write exactly ONE complete sentence with this structure: "[Problem] - [specific food suggestion]."

EXAMPLES:
- "Your calcium looks low - try adding yogurt, cheese, or fortified plant milk."
- "You may need more fiber - consider oats, beans, or vegetables at your next meal."
- "Your vitamin D could be lacking - fatty fish like salmon or fortified foods can help."

RULES:
- NEVER praise. Focus only on gaps and solutions.
- Must be a COMPLETE sentence ending with a period.
- Keep under 25 words.`;
}

function buildInsightsChatPrompt(userMessage: string, context: NutritionContext): string {
    const { userProfile, goals, todayTotals, recentMeals } = context;

    // Build profile string - weight is stored as the user entered it (not converted)
    let profileStr = 'No profile set';
    if (userProfile) {
        const unit = userProfile.weight_unit || 'kg';
        const weightDisplay = userProfile.weight_kg ? `${userProfile.weight_kg}${unit}` : 'not set';
        const goalTypeDisplay = userProfile.goal_type === 'weight_loss' ? 'Weight Loss'
            : userProfile.goal_type === 'weight_gain' ? 'Weight Gain'
                : 'Maintain Weight';
        profileStr = `Age: ${userProfile.age || 'not set'}, Gender: ${userProfile.gender || 'not set'}, Weight: ${weightDisplay}, Goal: ${goalTypeDisplay}`;
    }

    return `You are a nutrition analyst. Be DIRECT, FACTUAL, and SPECIFIC. Answer EXACTLY what the user asks - nothing more, nothing less. No fluff, no motivational language.

USER PROFILE:
${profileStr}

DATA:
${goals ? `Goals: ${goals.target_calories} cal, ${goals.target_protein_g}g P, ${goals.target_carbs_g}g C, ${goals.target_fat_g}g F` : 'No goals set'}
${todayTotals ? `Today: ${todayTotals.calories} cal, ${Math.round(todayTotals.protein_g)}g P, ${Math.round(todayTotals.carbs_g)}g C, ${Math.round(todayTotals.fat_g)}g F` : 'Nothing logged today'}

MEAL HISTORY:
${recentMeals.length > 0 ? recentMeals.slice(0, 15).map(m => `${m.date}: ${m.title} - ${m.calories}cal, ${Math.round(m.protein_g)}g P`).join('\n') : 'No recent meals'}

QUESTION: "${userMessage}"

RULES:
1. Answer the specific question directly
2. Use bullet points (• or -) for lists
3. Be concise but complete
4. If asking about nutrients/deficiencies, analyze their actual meal data
5. No cheerleading or "great job" statements
6. If data is insufficient to answer, say so
7. DO NOT use markdown formatting (no **bold**, no *italic*) - use plain text only
8. WHEN SUGGESTING MEALS: List ingredients with quantities, then provide BOTH macros AND micronutrients in this FORMAT:
   - Calories: X
   - Protein: Xg
   - Carbs: Xg
   - Fat: Xg
   - Vitamin C: Xmg
   - Iron: Xmg
   - Calcium: Xmg
   - Potassium: Xmg
   - Sodium: Xmg`;
}

// ============================================
// MEAL SUGGESTIONS
// ============================================

export interface MealSuggestion {
    name: string;
    description: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    // Micronutrients
    vitamin_c_mg?: number;
    vitamin_d_mcg?: number;
    calcium_mg?: number;
    iron_mg?: number;
    potassium_mg?: number;
    sodium_mg?: number;
}

export interface RemainingMacros {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
}

/**
 * Generate meal suggestions based on remaining macro targets
 */
export type MacroPreference = 'exact' | 'under' | 'micronutrient' | 'tasty' | 'healthy';

export const suggestMealsForMacros = async (
    remaining: RemainingMacros,
    preference: MacroPreference = 'exact',
    mealCount: 1 | 2 | 3 = 2,
    model: GeminiModel = GEMINI_MODELS.FLASH,
    remainingMicros?: {
        vitamin_c_mg?: number;
        vitamin_d_mcg?: number;
        calcium_mg?: number;
        iron_mg?: number;
        potassium_mg?: number;
    }
): Promise<MealSuggestion[]> => {
    // Calculate macro multiplier based on preference
    const mult = preference === 'under' ? 0.75 : 1;
    const cal = Math.round(remaining.calories * mult);
    const p = Math.round(remaining.protein_g * mult);
    const c = Math.round(remaining.carbs_g * mult);
    const f = Math.round(remaining.fat_g * mult);

    // Each meal gets the full target macros (percentage already applied by caller)
    const mealTemplate = `{"name":"","description":"","calories":${cal},"protein_g":${p},"carbs_g":${c},"fat_g":${f},"vitamin_c_mg":0,"calcium_mg":0,"iron_mg":0}`;

    const mealList = mealCount === 1
        ? `[${mealTemplate}]`
        : mealCount === 2
            ? `[${mealTemplate},${mealTemplate}]`
            : `[${mealTemplate},${mealTemplate},${mealTemplate}]`;

    // Target info for guidance (keep concise to avoid truncation)
    const targetInfo = `Target: ~${cal}cal, ~${p}g protein per meal.`;

    // Build prompt based on preference strategy
    let prompt: string;

    switch (preference) {
        case 'micronutrient':
            prompt = `Generate ${mealCount} vitamin-rich meal(s). ${targetInfo} Include exact portions like 6oz salmon or 2 cups spinach. JSON:\n${mealList}`;
            break;

        case 'tasty':
            prompt = `Generate ${mealCount} comfort food meal(s). ${targetInfo} Include exact portions like 8oz pasta or 4 strips bacon. JSON:\n${mealList}`;
            break;

        case 'healthy':
        default:
            prompt = `Generate ${mealCount} balanced meal(s). ${targetInfo} Include exact portions like 5oz chicken or 1 cup rice. JSON:\n${mealList}`;
            break;
    }

    console.log('📤 Prompt:', prompt.slice(0, 200));
    console.log(`🔢 Input: ${remaining.protein_g}g protein, generating ${mealCount} meals at ${p}g each`);

    try {
        const response = await fetch(
            `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 8192,  // Large to prevent truncation
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        const data = await response.json();

        // Check for API errors
        if (data.error) {
            console.error('Gemini API error:', data.error);
            return getFallbackSuggestions(remaining, mealCount);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('No response from Gemini:', JSON.stringify(data).slice(0, 200));
            return getFallbackSuggestions(remaining, mealCount);
        }

        console.log('Gemini meal suggestion raw:', text.slice(0, 500));

        try {
            const parsed = JSON.parse(text.trim());
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Verify macros add up
                const totalCal = parsed.reduce((sum: number, m: MealSuggestion) => sum + (m.calories || 0), 0);
                const totalP = parsed.reduce((sum: number, m: MealSuggestion) => sum + (m.protein_g || 0), 0);
                const totalC = parsed.reduce((sum: number, m: MealSuggestion) => sum + (m.carbs_g || 0), 0);
                const totalF = parsed.reduce((sum: number, m: MealSuggestion) => sum + (m.fat_g || 0), 0);

                console.log(`🎯 TARGET (per meal): ${cal}cal / ${p}P / ${c}C / ${f}F`);
                console.log(`🎯 TARGET (total for ${mealCount} meals): ${cal * mealCount}cal / ${p * mealCount}P`);
                console.log(`📊 AI RETURNED (total): ${totalCal}cal / ${totalP}P / ${totalC}C / ${totalF}F`);

                // Compare against TOTAL target (p * mealCount), not per-meal
                const targetTotalP = p * mealCount;
                const targetTotalCal = cal * mealCount;
                const targetTotalC = c * mealCount;
                const targetTotalF = f * mealCount;

                // If off by more than 10% from TOTAL target, adjust proportionally
                if (Math.abs(totalP - targetTotalP) > targetTotalP * 0.1) {
                    console.log('⚠️ Adjusting macros to match targets...');
                    const calRatio = targetTotalCal / (totalCal || 1);
                    const pRatio = targetTotalP / (totalP || 1);
                    const cRatio = targetTotalC / (totalC || 1);
                    const fRatio = targetTotalF / (totalF || 1);

                    parsed.forEach((meal: MealSuggestion) => {
                        meal.calories = Math.round((meal.calories || 0) * calRatio);
                        meal.protein_g = Math.round((meal.protein_g || 0) * pRatio);
                        meal.carbs_g = Math.round((meal.carbs_g || 0) * cRatio);
                        meal.fat_g = Math.round((meal.fat_g || 0) * fRatio);
                    });
                    console.log('✅ Adjusted to match targets');
                }

                return parsed;
            }
        } catch (parseError) {
            console.error('JSON parse failed, trying extraction:', parseError);

            // Try to extract valid JSON from partial response
            const arrayMatch = text.match(/\[\s*\{[^[\]]*\}\s*(?:,\s*\{[^[\]]*\}\s*)*\]/);
            if (arrayMatch) {
                try {
                    return JSON.parse(arrayMatch[0]);
                } catch {
                    // Fall through to fallback
                }
            }
        }

        return getFallbackSuggestions(remaining, mealCount);
    } catch (error) {
        console.error('Error generating meal suggestions:', error);
        return getFallbackSuggestions(remaining, mealCount);
    }
};

function getFallbackSuggestions(remaining: RemainingMacros, mealCount: 1 | 2 | 3 = 2): MealSuggestion[] {
    console.log(`⚠️ Using FALLBACK suggestions (${mealCount} meals) - API may have failed`);
    const targetCal = Math.round(remaining.calories / mealCount);
    const targetP = Math.round(remaining.protein_g / mealCount);
    const targetC = Math.round(remaining.carbs_g / mealCount);
    const targetF = Math.round(remaining.fat_g / mealCount);

    // Randomized meal options with SPECIFIC quantities
    const mealOptions: MealSuggestion[] = [
        { name: "Grilled Salmon Bowl", description: "6oz baked salmon, 1 cup cooked quinoa, 1 cup steamed broccoli, 1 tbsp olive oil", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
        { name: "Turkey Taco Bowl", description: "6oz ground turkey, 1/2 cup black beans, 1 cup rice, 2 tbsp salsa, 1/4 avocado", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
        { name: "Steak & Sweet Potato", description: "6oz sirloin steak, 1 medium sweet potato, 1 cup asparagus, 1 tbsp butter", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
        { name: "Shrimp Stir-Fry", description: "8oz shrimp, 1 cup mixed vegetables, 1 cup jasmine rice, 1 tbsp sesame oil", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
        { name: "Tofu Buddha Bowl", description: "8oz firm tofu, 1 cup brown rice, 1/2 cup edamame, 1/4 avocado, 1 tbsp tahini", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
        { name: "Chicken Caesar Wrap", description: "6oz grilled chicken, 1 large whole wheat wrap, 2 cups romaine, 2 tbsp caesar dressing", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
        { name: "Protein Smoothie", description: "2 scoops protein powder, 1 banana, 2 tbsp almond butter, 1 cup oats, 1 cup almond milk", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
        { name: "Egg & Avocado Toast", description: "4 large eggs, 2 slices whole grain bread, 1/2 avocado, 1 tbsp olive oil", calories: targetCal, protein_g: targetP, carbs_g: targetC, fat_g: targetF },
    ];

    // Pick correct number of random meals
    const shuffled = mealOptions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, mealCount);
}


