/**
 * Recommendation Engine for TrueForm AI
 * 
 * Calculates the optimal ratio of stretches, strengthening, and mobility exercises
 * based on user demographics, occupation, pain profile, and goals.
 */

export interface UserProfile {
    age?: number | null;
    occupation_type?: 'sedentary' | 'active' | 'physical' | null;
}

export interface PainContext {
    pain_areas: string[];
    pain_duration: string;
    pain_triggers: string[];
    goals: string[];
}

export interface RecommendationRatio {
    stretches: number;      // e.g., 0.4 = 40% of exercises
    strengthening: number;  // e.g., 0.35
    mobility: number;       // e.g., 0.25
}

export interface RecommendationCounts {
    stretches: number;
    strengthening: number;
    mobility: number;
    reasoning: string;
}

/**
 * Normalize ratio to ensure sum equals 1.0
 */
const normalizeRatio = (ratio: RecommendationRatio): RecommendationRatio => {
    const total = ratio.stretches + ratio.strengthening + ratio.mobility;
    return {
        stretches: ratio.stretches / total,
        strengthening: ratio.strengthening / total,
        mobility: ratio.mobility / total,
    };
};

/**
 * Calculate the recommended exercise ratio based on user profile and pain context.
 * 
 * Logic:
 * - Base: Equal distribution (33% each)
 * - Age 55+: More mobility (+15%), less strengthening (-15%)
 * - Sedentary workers: More mobility (+10%) and stretches (+5%), less strength (-15%)
 * - Physical laborers: More stretches (+15%) for recovery, less strength (-15%)
 * - Chronic pain (>3 months): More gentle stretching (+10%), less strength (-10%)
 * - Goals-based adjustments for strength and mobility focus
 */
export const calculateRecommendationRatio = (
    profile: UserProfile | null,
    painContext: PainContext | null
): RecommendationRatio => {
    // Start with equal distribution
    let ratio: RecommendationRatio = {
        stretches: 0.33,
        strengthening: 0.34,
        mobility: 0.33,
    };

    if (!profile && !painContext) {
        return ratio;
    }

    // Age adjustments (older adults benefit from more mobility work)
    if (profile?.age && profile.age >= 55) {
        ratio.mobility += 0.15;
        ratio.strengthening -= 0.15;
    } else if (profile?.age && profile.age >= 45) {
        ratio.mobility += 0.08;
        ratio.strengthening -= 0.08;
    }

    // Occupation adjustments
    if (profile?.occupation_type === 'sedentary') {
        // Desk workers need more mobility for stiff joints
        ratio.mobility += 0.10;
        ratio.stretches += 0.05;
        ratio.strengthening -= 0.15;
    } else if (profile?.occupation_type === 'physical') {
        // Physical laborers need more stretches for overworked muscles
        ratio.stretches += 0.15;
        ratio.mobility += 0.05;
        ratio.strengthening -= 0.20; // Avoid adding more strain
    }

    // Pain duration adjustments
    if (painContext?.pain_duration === 'more_than_3_months') {
        // Chronic pain: gentle approach, focus on stretching
        ratio.stretches += 0.10;
        ratio.strengthening -= 0.10;
    } else if (painContext?.pain_duration === 'less_than_week') {
        // Acute pain: more mobility to maintain ROM, less strengthening
        ratio.mobility += 0.05;
        ratio.strengthening -= 0.05;
    }

    // Goals adjustments
    if (painContext?.goals) {
        if (painContext.goals.includes('build_strength')) {
            ratio.strengthening += 0.15;
            ratio.stretches -= 0.08;
            ratio.mobility -= 0.07;
        }
        if (painContext.goals.includes('improve_mobility')) {
            ratio.mobility += 0.12;
            ratio.strengthening -= 0.08;
            ratio.stretches -= 0.04;
        }
        if (painContext.goals.includes('better_posture')) {
            // Posture benefits from stretches and strengthening
            ratio.stretches += 0.05;
            ratio.strengthening += 0.05;
            ratio.mobility -= 0.10;
        }
    }

    // Pain trigger adjustments
    if (painContext?.pain_triggers) {
        if (painContext.pain_triggers.includes('sitting')) {
            // Sitting triggers: more mobility and hip flexor stretches
            ratio.mobility += 0.05;
            ratio.stretches += 0.05;
            ratio.strengthening -= 0.10;
        }
        if (painContext.pain_triggers.includes('lifting')) {
            // Lifting triggers: more core strengthening, but gentle
            ratio.strengthening += 0.05;
            ratio.stretches += 0.05;
            ratio.mobility -= 0.10;
        }
    }

    // Ensure no negative values before normalizing
    ratio.stretches = Math.max(0.1, ratio.stretches);
    ratio.strengthening = Math.max(0.1, ratio.strengthening);
    ratio.mobility = Math.max(0.1, ratio.mobility);

    return normalizeRatio(ratio);
};

/**
 * Convert ratio to actual exercise counts for a given total.
 * Ensures at least 1 exercise per category if total >= 3.
 */
export const calculateExerciseCounts = (
    ratio: RecommendationRatio,
    totalExercises: number,
    profile: UserProfile | null,
    painContext: PainContext | null
): RecommendationCounts => {
    // Calculate raw counts
    let stretches = Math.round(ratio.stretches * totalExercises);
    let strengthening = Math.round(ratio.strengthening * totalExercises);
    let mobility = Math.round(ratio.mobility * totalExercises);

    // Ensure at least 1 per category if total >= 3
    if (totalExercises >= 3) {
        if (stretches < 1) stretches = 1;
        if (strengthening < 1) strengthening = 1;
        if (mobility < 1) mobility = 1;
    }

    // Adjust to match total
    const currentTotal = stretches + strengthening + mobility;
    if (currentTotal > totalExercises) {
        // Remove from highest category
        if (stretches >= strengthening && stretches >= mobility) {
            stretches -= (currentTotal - totalExercises);
        } else if (strengthening >= mobility) {
            strengthening -= (currentTotal - totalExercises);
        } else {
            mobility -= (currentTotal - totalExercises);
        }
    } else if (currentTotal < totalExercises) {
        // Add to lowest category  
        const diff = totalExercises - currentTotal;
        if (stretches <= strengthening && stretches <= mobility) {
            stretches += diff;
        } else if (mobility <= strengthening) {
            mobility += diff;
        } else {
            strengthening += diff;
        }
    }

    // Generate reasoning
    const reasoning = generateReasoning(profile, painContext, ratio);

    return {
        stretches: Math.max(0, stretches),
        strengthening: Math.max(0, strengthening),
        mobility: Math.max(0, mobility),
        reasoning,
    };
};

/**
 * Generate human-readable reasoning for the recommendation.
 */
const generateReasoning = (
    profile: UserProfile | null,
    painContext: PainContext | null,
    ratio: RecommendationRatio
): string => {
    const reasons: string[] = [];

    // Determine dominant category
    const maxRatio = Math.max(ratio.stretches, ratio.strengthening, ratio.mobility);
    let focus = '';
    if (ratio.mobility === maxRatio) focus = 'mobility work';
    else if (ratio.stretches === maxRatio) focus = 'stretches';
    else focus = 'strengthening';

    if (profile?.age && profile.age >= 55) {
        reasons.push('Age-appropriate focus on joint mobility');
    }

    if (profile?.occupation_type === 'sedentary') {
        reasons.push('Countering effects of prolonged sitting');
    } else if (profile?.occupation_type === 'physical') {
        reasons.push('Recovery-focused for physical work demands');
    }

    if (painContext?.pain_duration === 'more_than_3_months') {
        reasons.push('Gentle approach for chronic symptoms');
    }

    if (painContext?.goals?.includes('build_strength')) {
        reasons.push('Progression toward strength goals');
    }
    if (painContext?.goals?.includes('improve_mobility')) {
        reasons.push('Emphasis on range of motion');
    }

    if (reasons.length === 0) {
        return `Balanced program with emphasis on ${focus}`;
    }

    return reasons.slice(0, 2).join('. ') + `. Emphasis on ${focus}.`;
};

/**
 * Quick utility to get counts for a standard 6-exercise daily routine.
 */
export const getDefaultRecommendationCounts = (
    profile: UserProfile | null,
    painContext: PainContext | null
): RecommendationCounts => {
    const ratio = calculateRecommendationRatio(profile, painContext);
    return calculateExerciseCounts(ratio, 6, profile, painContext);
};
