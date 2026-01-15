/**
 * Nutrition utility functions for RDA calculations
 * Based on NIH/FDA Recommended Daily Allowances
 */

export type Gender = 'male' | 'female';

export interface RecommendedMicros {
    vitamin_c_mg: number;
    vitamin_d_mcg: number;
    calcium_mg: number;
    iron_mg: number;
    potassium_mg: number;
    sodium_mg: number;
}

/**
 * Calculate recommended micronutrient intake based on age and gender
 * Sources: NIH Office of Dietary Supplements, FDA Daily Values
 */
export function calculateRecommendedMicros(age: number = 30, gender: Gender = 'male'): RecommendedMicros {
    // Base values for adults (19-50 years)
    let micros: RecommendedMicros = {
        vitamin_c_mg: gender === 'male' ? 90 : 75,
        vitamin_d_mcg: 15, // 600 IU = 15mcg
        calcium_mg: 1000,
        iron_mg: gender === 'male' ? 8 : 18, // Women need more iron
        potassium_mg: gender === 'male' ? 3400 : 2600,
        sodium_mg: 2300, // Upper limit
    };

    // Adjust for age
    if (age >= 51 && age <= 70) {
        micros.vitamin_d_mcg = 15;
        micros.calcium_mg = gender === 'female' ? 1200 : 1000;
        micros.iron_mg = 8; // Post-menopause, women need less iron
    } else if (age > 70) {
        micros.vitamin_d_mcg = 20; // 800 IU
        micros.calcium_mg = 1200;
        micros.iron_mg = 8;
    } else if (age < 19 && age >= 14) {
        // Adolescents
        micros.vitamin_c_mg = gender === 'male' ? 75 : 65;
        micros.calcium_mg = 1300;
        micros.iron_mg = gender === 'male' ? 11 : 15;
    }

    return micros;
}

/**
 * Get display labels and units for micronutrients
 */
export const MICRO_LABELS: Record<keyof RecommendedMicros, { label: string; unit: string }> = {
    vitamin_c_mg: { label: 'Vitamin C', unit: 'mg' },
    vitamin_d_mcg: { label: 'Vitamin D', unit: 'mcg' },
    calcium_mg: { label: 'Calcium', unit: 'mg' },
    iron_mg: { label: 'Iron', unit: 'mg' },
    potassium_mg: { label: 'Potassium', unit: 'mg' },
    sodium_mg: { label: 'Sodium (max)', unit: 'mg' },
};

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface RecommendedMacros {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
}

/**
 * Calculate recommended macronutrient intake based on age, gender, weight, and activity
 * Uses Mifflin-St Jeor equation for BMR, then applies activity multiplier
 */
export function calculateRecommendedMacros(
    age: number = 30,
    gender: Gender = 'male',
    weight_kg: number = 70,
    activity: ActivityLevel = 'moderate'
): RecommendedMacros {
    // Mifflin-St Jeor BMR equation (assuming average height)
    const avgHeight = gender === 'male' ? 175 : 162; // cm
    let bmr: number;

    if (gender === 'male') {
        bmr = 10 * weight_kg + 6.25 * avgHeight - 5 * age + 5;
    } else {
        bmr = 10 * weight_kg + 6.25 * avgHeight - 5 * age - 161;
    }

    // Activity multipliers
    const activityMultipliers: Record<ActivityLevel, number> = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9,
    };

    const tdee = Math.round(bmr * activityMultipliers[activity]);

    // Macro split: ~30% protein, ~40% carbs, ~30% fat (balanced)
    const protein_g = Math.round((tdee * 0.30) / 4); // 4 cal/g
    const carbs_g = Math.round((tdee * 0.40) / 4);   // 4 cal/g
    const fat_g = Math.round((tdee * 0.30) / 9);     // 9 cal/g

    return {
        calories: tdee,
        protein_g,
        carbs_g,
        fat_g,
    };
}
