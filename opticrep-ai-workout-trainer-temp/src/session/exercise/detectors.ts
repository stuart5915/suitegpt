import type { Landmark } from '@/types';
import { PoseLandmark } from '@/types';

export interface ExerciseDetector {
    name: string;
    /** Calculate angle and determine if in "down" position */
    detect(landmarks: Landmark[]): { angle: number; isDown: boolean } | null;
}

// Calculate angle between three points
function calculateAngle(
    a: Landmark,
    b: Landmark,  // vertex
    c: Landmark
): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) -
        Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
}

// Calculate average of left and right side
function avgSides(left: number, right: number): number {
    return (left + right) / 2;
}

// ========== DETECTORS ==========

const bicepCurlDetector: ExerciseDetector = {
    name: 'Bicep Curl',
    detect(landmarks) {
        if (landmarks.length < 17) return null;

        const leftAngle = calculateAngle(
            landmarks[PoseLandmark.LEFT_SHOULDER],
            landmarks[PoseLandmark.LEFT_ELBOW],
            landmarks[PoseLandmark.LEFT_WRIST]
        );
        const rightAngle = calculateAngle(
            landmarks[PoseLandmark.RIGHT_SHOULDER],
            landmarks[PoseLandmark.RIGHT_ELBOW],
            landmarks[PoseLandmark.RIGHT_WRIST]
        );

        const angle = avgSides(leftAngle, rightAngle);
        return { angle, isDown: angle < 70 };
    }
};

const squatDetector: ExerciseDetector = {
    name: 'Squat',
    detect(landmarks) {
        if (landmarks.length < 28) return null;

        const leftAngle = calculateAngle(
            landmarks[PoseLandmark.LEFT_HIP],
            landmarks[PoseLandmark.LEFT_KNEE],
            landmarks[PoseLandmark.LEFT_ANKLE]
        );
        const rightAngle = calculateAngle(
            landmarks[PoseLandmark.RIGHT_HIP],
            landmarks[PoseLandmark.RIGHT_KNEE],
            landmarks[PoseLandmark.RIGHT_ANKLE]
        );

        const angle = avgSides(leftAngle, rightAngle);
        return { angle, isDown: angle < 90 };
    }
};

const pushupDetector: ExerciseDetector = {
    name: 'Pushup',
    detect(landmarks) {
        if (landmarks.length < 17) return null;

        const leftAngle = calculateAngle(
            landmarks[PoseLandmark.LEFT_SHOULDER],
            landmarks[PoseLandmark.LEFT_ELBOW],
            landmarks[PoseLandmark.LEFT_WRIST]
        );
        const rightAngle = calculateAngle(
            landmarks[PoseLandmark.RIGHT_SHOULDER],
            landmarks[PoseLandmark.RIGHT_ELBOW],
            landmarks[PoseLandmark.RIGHT_WRIST]
        );

        const angle = avgSides(leftAngle, rightAngle);
        return { angle, isDown: angle < 90 };
    }
};

const shoulderPressDetector: ExerciseDetector = {
    name: 'Shoulder Press',
    detect(landmarks) {
        if (landmarks.length < 17) return null;

        const leftAngle = calculateAngle(
            landmarks[PoseLandmark.LEFT_SHOULDER],
            landmarks[PoseLandmark.LEFT_ELBOW],
            landmarks[PoseLandmark.LEFT_WRIST]
        );
        const rightAngle = calculateAngle(
            landmarks[PoseLandmark.RIGHT_SHOULDER],
            landmarks[PoseLandmark.RIGHT_ELBOW],
            landmarks[PoseLandmark.RIGHT_WRIST]
        );

        const angle = avgSides(leftAngle, rightAngle);
        // For shoulder press, down is elbow at ~100°, up is arm extended >170°
        return { angle, isDown: angle < 100 };
    }
};

const latPulldownDetector: ExerciseDetector = {
    name: 'Lat Pulldown',
    detect(landmarks) {
        if (landmarks.length < 17) return null;

        const leftAngle = calculateAngle(
            landmarks[PoseLandmark.LEFT_SHOULDER],
            landmarks[PoseLandmark.LEFT_ELBOW],
            landmarks[PoseLandmark.LEFT_WRIST]
        );
        const rightAngle = calculateAngle(
            landmarks[PoseLandmark.RIGHT_SHOULDER],
            landmarks[PoseLandmark.RIGHT_ELBOW],
            landmarks[PoseLandmark.RIGHT_WRIST]
        );

        const angle = avgSides(leftAngle, rightAngle);
        // Down is pulling the bar down (elbows bent), up is arms extended
        return { angle, isDown: angle < 90 };
    }
};

// Pec Deck / Chest Fly - tracks arms coming together
const pecDeckDetector: ExerciseDetector = {
    name: 'Pec Deck',
    detect(landmarks) {
        if (landmarks.length < 17) return null;

        const leftWrist = landmarks[PoseLandmark.LEFT_WRIST];
        const rightWrist = landmarks[PoseLandmark.RIGHT_WRIST];
        const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
        const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];

        // Calculate horizontal distance between wrists relative to shoulder width
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const wristDistance = Math.abs(rightWrist.x - leftWrist.x);

        // Ratio: 0 = hands together, 1+ = arms spread
        const ratio = wristDistance / Math.max(shoulderWidth, 0.01);

        // Convert ratio to angle-like value (0-180)
        const angle = ratio * 90;

        // Down/contracted = hands close together (ratio < 0.5)
        return { angle, isDown: ratio < 0.5 };
    }
};

// Generic fallback - uses elbow angle like bicep curl
const genericDetector: ExerciseDetector = {
    name: 'Generic',
    detect(landmarks) {
        if (landmarks.length < 17) return null;

        const leftAngle = calculateAngle(
            landmarks[PoseLandmark.LEFT_SHOULDER],
            landmarks[PoseLandmark.LEFT_ELBOW],
            landmarks[PoseLandmark.LEFT_WRIST]
        );
        const rightAngle = calculateAngle(
            landmarks[PoseLandmark.RIGHT_SHOULDER],
            landmarks[PoseLandmark.RIGHT_ELBOW],
            landmarks[PoseLandmark.RIGHT_WRIST]
        );

        const angle = avgSides(leftAngle, rightAngle);
        return { angle, isDown: angle < 80 };
    }
};

// ========== REGISTRY ==========

// Map exercise names (lowercase, normalized) to detectors
const detectorRegistry: Record<string, ExerciseDetector> = {
    // Bicep variations
    'bicep curl': bicepCurlDetector,
    'bicep curls': bicepCurlDetector,
    'hammer curl': bicepCurlDetector,
    'hammer curls': bicepCurlDetector,
    'dumbbell curl': bicepCurlDetector,
    'barbell curl': bicepCurlDetector,
    'curl': bicepCurlDetector,
    'curls': bicepCurlDetector,

    // Squat variations
    'squat': squatDetector,
    'squats': squatDetector,
    'goblet squat': squatDetector,
    'front squat': squatDetector,
    'back squat': squatDetector,

    // Pushup variations
    'pushup': pushupDetector,
    'pushups': pushupDetector,
    'push up': pushupDetector,
    'push ups': pushupDetector,
    'push-up': pushupDetector,
    'push-ups': pushupDetector,

    // Shoulder press variations
    'shoulder press': shoulderPressDetector,
    'overhead press': shoulderPressDetector,
    'military press': shoulderPressDetector,
    'dumbbell press': shoulderPressDetector,

    // Lat pulldown variations
    'lat pulldown': latPulldownDetector,
    'pulldown': latPulldownDetector,
    'pull down': latPulldownDetector,

    // Pec deck / chest fly variations
    'pec deck': pecDeckDetector,
    'peck deck': pecDeckDetector,
    'chest fly': pecDeckDetector,
    'chest flye': pecDeckDetector,
    'dumbbell fly': pecDeckDetector,
    'cable fly': pecDeckDetector,
    'fly': pecDeckDetector,
};

/**
 * Get the appropriate detector for an exercise name
 * Falls back to generic detector if not found
 */
export function getDetector(exerciseName: string): ExerciseDetector {
    const normalized = exerciseName.toLowerCase().trim();
    return detectorRegistry[normalized] || genericDetector;
}

/**
 * Get all registered exercise names
 */
export function getRegisteredExercises(): string[] {
    return Object.keys(detectorRegistry);
}
