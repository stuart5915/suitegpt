/**
 * MediaPipe Pose Landmark indices
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export enum PoseLandmark {
    NOSE = 0,
    LEFT_EYE_INNER = 1,
    LEFT_EYE = 2,
    LEFT_EYE_OUTER = 3,
    RIGHT_EYE_INNER = 4,
    RIGHT_EYE = 5,
    RIGHT_EYE_OUTER = 6,
    LEFT_EAR = 7,
    RIGHT_EAR = 8,
    MOUTH_LEFT = 9,
    MOUTH_RIGHT = 10,
    LEFT_SHOULDER = 11,
    RIGHT_SHOULDER = 12,
    LEFT_ELBOW = 13,
    RIGHT_ELBOW = 14,
    LEFT_WRIST = 15,
    RIGHT_WRIST = 16,
    LEFT_PINKY = 17,
    RIGHT_PINKY = 18,
    LEFT_INDEX = 19,
    RIGHT_INDEX = 20,
    LEFT_THUMB = 21,
    RIGHT_THUMB = 22,
    LEFT_HIP = 23,
    RIGHT_HIP = 24,
    LEFT_KNEE = 25,
    RIGHT_KNEE = 26,
    LEFT_ANKLE = 27,
    RIGHT_ANKLE = 28,
    LEFT_HEEL = 29,
    RIGHT_HEEL = 30,
    LEFT_FOOT_INDEX = 31,
    RIGHT_FOOT_INDEX = 32,
}

/**
 * A single 3D landmark point with visibility
 */
export interface Landmark {
    x: number; // 0.0 - 1.0 (normalized to frame width)
    y: number; // 0.0 - 1.0 (normalized to frame height)
    z: number; // Depth relative to hips (negative = closer to camera)
    visibility: number; // 0.0 - 1.0 (confidence)
}

/**
 * Full pose with all 33 landmarks
 */
export interface PoseLandmarks {
    landmarks: Landmark[];
    worldLandmarks?: Landmark[]; // Real-world 3D coordinates in meters
    timestamp: number;
}

/**
 * Tracking status for the HUD
 */
export type TrackingStatus = 'tracking' | 'partial' | 'occluded' | 'no_person';

/**
 * Rep detection phase
 */
export type RepPhase = 'idle' | 'eccentric' | 'bottom' | 'concentric' | 'top';

/**
 * Skeleton connection for Skia drawing
 */
export interface SkeletonConnection {
    from: PoseLandmark;
    to: PoseLandmark;
}

/**
 * Standard skeleton connections for drawing
 */
export const SKELETON_CONNECTIONS: SkeletonConnection[] = [
    // Torso
    { from: PoseLandmark.LEFT_SHOULDER, to: PoseLandmark.RIGHT_SHOULDER },
    { from: PoseLandmark.LEFT_SHOULDER, to: PoseLandmark.LEFT_HIP },
    { from: PoseLandmark.RIGHT_SHOULDER, to: PoseLandmark.RIGHT_HIP },
    { from: PoseLandmark.LEFT_HIP, to: PoseLandmark.RIGHT_HIP },

    // Left arm
    { from: PoseLandmark.LEFT_SHOULDER, to: PoseLandmark.LEFT_ELBOW },
    { from: PoseLandmark.LEFT_ELBOW, to: PoseLandmark.LEFT_WRIST },

    // Right arm
    { from: PoseLandmark.RIGHT_SHOULDER, to: PoseLandmark.RIGHT_ELBOW },
    { from: PoseLandmark.RIGHT_ELBOW, to: PoseLandmark.RIGHT_WRIST },

    // Left leg
    { from: PoseLandmark.LEFT_HIP, to: PoseLandmark.LEFT_KNEE },
    { from: PoseLandmark.LEFT_KNEE, to: PoseLandmark.LEFT_ANKLE },

    // Right leg
    { from: PoseLandmark.RIGHT_HIP, to: PoseLandmark.RIGHT_KNEE },
    { from: PoseLandmark.RIGHT_KNEE, to: PoseLandmark.RIGHT_ANKLE },
];

/**
 * Joint angle configuration for rep detection
 */
export interface JointAngleConfig {
    primary: PoseLandmark;   // The vertex of the angle (e.g., elbow)
    secondary: PoseLandmark; // First connected joint (e.g., shoulder)
    tertiary: PoseLandmark;  // Second connected joint (e.g., wrist)
}

/**
 * Common joint angle configurations
 */
export const JOINT_ANGLES = {
    leftElbow: {
        primary: PoseLandmark.LEFT_ELBOW,
        secondary: PoseLandmark.LEFT_SHOULDER,
        tertiary: PoseLandmark.LEFT_WRIST,
    } as JointAngleConfig,
    rightElbow: {
        primary: PoseLandmark.RIGHT_ELBOW,
        secondary: PoseLandmark.RIGHT_SHOULDER,
        tertiary: PoseLandmark.RIGHT_WRIST,
    } as JointAngleConfig,
    leftKnee: {
        primary: PoseLandmark.LEFT_KNEE,
        secondary: PoseLandmark.LEFT_HIP,
        tertiary: PoseLandmark.LEFT_ANKLE,
    } as JointAngleConfig,
    rightKnee: {
        primary: PoseLandmark.RIGHT_KNEE,
        secondary: PoseLandmark.RIGHT_HIP,
        tertiary: PoseLandmark.RIGHT_ANKLE,
    } as JointAngleConfig,
    leftHip: {
        primary: PoseLandmark.LEFT_HIP,
        secondary: PoseLandmark.LEFT_SHOULDER,
        tertiary: PoseLandmark.LEFT_KNEE,
    } as JointAngleConfig,
    rightHip: {
        primary: PoseLandmark.RIGHT_HIP,
        secondary: PoseLandmark.RIGHT_SHOULDER,
        tertiary: PoseLandmark.RIGHT_KNEE,
    } as JointAngleConfig,
};
