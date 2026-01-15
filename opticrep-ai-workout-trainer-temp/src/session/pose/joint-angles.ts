import type { Landmark } from '@/types';

/**
 * Calculate the angle between three landmarks in degrees.
 * The angle is measured at point b (the vertex).
 * 
 * @param a - First landmark (e.g., shoulder)
 * @param b - Middle landmark / vertex (e.g., elbow)
 * @param c - Third landmark (e.g., wrist)
 * @returns Angle in degrees (0-180)
 */
export function calculateJointAngle(
    a: Landmark,
    b: Landmark,
    c: Landmark
): number {
    // Vectors from b to a and from b to c
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };

    // Dot product
    const dotProduct = ba.x * bc.x + ba.y * bc.y;

    // Magnitudes
    const magnitudeBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
    const magnitudeBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);

    // Avoid division by zero
    if (magnitudeBA === 0 || magnitudeBC === 0) {
        return 180;
    }

    // Angle in radians
    const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);

    // Clamp to avoid floating point errors
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));

    // Convert to degrees
    const angleRadians = Math.acos(clampedCos);
    const angleDegrees = angleRadians * (180 / Math.PI);

    return angleDegrees;
}

/**
 * Calculate multiple joint angles from a pose.
 */
export function calculateAllJointAngles(landmarks: Landmark[]): Record<string, number> {
    const angles: Record<string, number> = {};

    // Elbow angles
    if (landmarks[11] && landmarks[13] && landmarks[15]) {
        angles.leftElbow = calculateJointAngle(landmarks[11], landmarks[13], landmarks[15]);
    }
    if (landmarks[12] && landmarks[14] && landmarks[16]) {
        angles.rightElbow = calculateJointAngle(landmarks[12], landmarks[14], landmarks[16]);
    }

    // Knee angles
    if (landmarks[23] && landmarks[25] && landmarks[27]) {
        angles.leftKnee = calculateJointAngle(landmarks[23], landmarks[25], landmarks[27]);
    }
    if (landmarks[24] && landmarks[26] && landmarks[28]) {
        angles.rightKnee = calculateJointAngle(landmarks[24], landmarks[26], landmarks[28]);
    }

    // Hip angles
    if (landmarks[11] && landmarks[23] && landmarks[25]) {
        angles.leftHip = calculateJointAngle(landmarks[11], landmarks[23], landmarks[25]);
    }
    if (landmarks[12] && landmarks[24] && landmarks[26]) {
        angles.rightHip = calculateJointAngle(landmarks[12], landmarks[24], landmarks[26]);
    }

    // Shoulder angles
    if (landmarks[13] && landmarks[11] && landmarks[23]) {
        angles.leftShoulder = calculateJointAngle(landmarks[13], landmarks[11], landmarks[23]);
    }
    if (landmarks[14] && landmarks[12] && landmarks[24]) {
        angles.rightShoulder = calculateJointAngle(landmarks[14], landmarks[12], landmarks[24]);
    }

    return angles;
}

/**
 * Determine form quality based on symmetry between left and right sides.
 */
export function assessFormSymmetry(
    leftAngle: number,
    rightAngle: number,
    toleranceDegrees: number = 15
): 'good' | 'fair' | 'poor' {
    const difference = Math.abs(leftAngle - rightAngle);

    if (difference <= toleranceDegrees) {
        return 'good';
    } else if (difference <= toleranceDegrees * 2) {
        return 'fair';
    }
    return 'poor';
}
