// Diagnostic movements database - exercises per body part for AI-guided assessment

export interface Movement {
    id: string;
    name: string;
    instruction: string;
    cameraAngle: 'front' | 'side' | 'back';
    duration: number; // recommended seconds
    emoji: string;
}

export const DIAGNOSTIC_MOVEMENTS: Record<string, Movement[]> = {
    neck: [
        { id: 'neck_flex', name: 'Neck Flexion', instruction: 'Slowly lower chin to chest, then look up', cameraAngle: 'side', duration: 15, emoji: '🔽' },
        { id: 'neck_rotation', name: 'Neck Rotation', instruction: 'Turn head slowly left, then right', cameraAngle: 'front', duration: 15, emoji: '↔️' },
        { id: 'neck_tilt', name: 'Neck Tilt', instruction: 'Tilt ear toward shoulder, each side', cameraAngle: 'front', duration: 15, emoji: '↗️' },
        { id: 'neck_retraction', name: 'Chin Tuck', instruction: 'Pull chin straight back, hold briefly', cameraAngle: 'side', duration: 15, emoji: '🔙' },
        { id: 'neck_circles', name: 'Neck Circles', instruction: 'Slowly roll head in gentle circles', cameraAngle: 'front', duration: 20, emoji: '🔄' },
    ],
    shoulder: [
        { id: 'lateral_raise', name: 'Lateral Raise', instruction: 'Slowly raise arms out to sides, pause at pain', cameraAngle: 'front', duration: 20, emoji: '🙆' },
        { id: 'forward_flex', name: 'Forward Flexion', instruction: 'Raise arms forward and overhead', cameraAngle: 'side', duration: 20, emoji: '🙋' },
        { id: 'rotation', name: 'External Rotation', instruction: 'Elbows at sides, rotate forearms outward', cameraAngle: 'front', duration: 15, emoji: '🔄' },
        { id: 'cross_body', name: 'Cross Body Reach', instruction: 'Bring arm across body, hold gently', cameraAngle: 'front', duration: 15, emoji: '🤗' },
        { id: 'pendulum', name: 'Arm Pendulum', instruction: 'Lean forward, let arm swing gently', cameraAngle: 'side', duration: 20, emoji: '🔔' },
    ],
    'upper back': [
        { id: 'thoracic_rotation', name: 'Thoracic Rotation', instruction: 'Arms crossed, rotate upper body left and right', cameraAngle: 'front', duration: 20, emoji: '🔄' },
        { id: 'cat_cow', name: 'Cat-Cow Stretch', instruction: 'On all fours, arch and round your back', cameraAngle: 'side', duration: 20, emoji: '🐱' },
        { id: 'shoulder_squeeze', name: 'Shoulder Blade Squeeze', instruction: 'Squeeze shoulder blades together, hold', cameraAngle: 'back', duration: 15, emoji: '🤝' },
        { id: 'thread_needle', name: 'Thread the Needle', instruction: 'On all fours, reach arm under body and twist', cameraAngle: 'side', duration: 20, emoji: '🧵' },
        { id: 'chest_opener', name: 'Chest Opener', instruction: 'Clasp hands behind back, lift and squeeze', cameraAngle: 'side', duration: 15, emoji: '💪' },
    ],
    'lower back': [
        { id: 'forward_bend', name: 'Forward Bend', instruction: 'Slowly bend forward, reach toward toes', cameraAngle: 'side', duration: 20, emoji: '🙇' },
        { id: 'side_bend', name: 'Side Bend', instruction: 'Lean to each side, sliding hand down leg', cameraAngle: 'front', duration: 20, emoji: '↔️' },
        { id: 'lumbar_rotation', name: 'Lumbar Rotation', instruction: 'Lying down, drop knees side to side', cameraAngle: 'front', duration: 20, emoji: '🔄' },
        { id: 'pelvic_tilt', name: 'Pelvic Tilt', instruction: 'Lying down, flatten back then arch slightly', cameraAngle: 'side', duration: 15, emoji: '🔃' },
        { id: 'knee_to_chest', name: 'Knee to Chest', instruction: 'Lying down, pull one knee to chest, then other', cameraAngle: 'side', duration: 20, emoji: '🦵' },
    ],
    hip: [
        { id: 'hip_flex', name: 'Hip Flexion', instruction: 'Bring knee toward chest while standing', cameraAngle: 'side', duration: 20, emoji: '🦵' },
        { id: 'hip_rotation', name: 'Hip Rotation', instruction: 'Rotate leg inward and outward', cameraAngle: 'front', duration: 20, emoji: '🔄' },
        { id: 'hip_abduction', name: 'Hip Abduction', instruction: 'Lift leg out to the side', cameraAngle: 'front', duration: 15, emoji: '🦿' },
        { id: 'hip_extension', name: 'Hip Extension', instruction: 'Stand and extend leg behind you', cameraAngle: 'side', duration: 15, emoji: '🏃' },
        { id: 'figure_four', name: 'Figure Four Stretch', instruction: 'Cross ankle over knee, lean forward gently', cameraAngle: 'front', duration: 20, emoji: '4️⃣' },
    ],
    knee: [
        { id: 'knee_flex', name: 'Knee Flexion', instruction: 'Bend and straighten knee while sitting', cameraAngle: 'side', duration: 15, emoji: '🦵' },
        { id: 'squat', name: 'Partial Squat', instruction: 'Slowly squat down, pause at pain', cameraAngle: 'side', duration: 20, emoji: '🏋️' },
        { id: 'step_up', name: 'Step Up', instruction: 'Step onto a low step, alternate legs', cameraAngle: 'side', duration: 20, emoji: '🚶' },
        { id: 'lunge', name: 'Forward Lunge', instruction: 'Step forward into a lunge, alternate legs', cameraAngle: 'side', duration: 20, emoji: '🤸' },
        { id: 'heel_raise', name: 'Heel Raise', instruction: 'Rise up on toes, then lower slowly', cameraAngle: 'side', duration: 15, emoji: '⬆️' },
    ],
    other: [
        { id: 'full_body_scan', name: 'Full Body Movement', instruction: 'Move freely, pause where you feel pain', cameraAngle: 'front', duration: 30, emoji: '🧘' },
        { id: 'walk', name: 'Walking Assessment', instruction: 'Walk back and forth naturally', cameraAngle: 'side', duration: 20, emoji: '🚶' },
        { id: 'balance', name: 'Single Leg Balance', instruction: 'Stand on one leg, then the other', cameraAngle: 'front', duration: 20, emoji: '🦩' },
        { id: 'squat_general', name: 'Bodyweight Squat', instruction: 'Perform a slow, controlled squat', cameraAngle: 'side', duration: 20, emoji: '🏋️' },
        { id: 'arm_circles', name: 'Arm Circles', instruction: 'Make large circles with both arms', cameraAngle: 'front', duration: 15, emoji: '⭕' },
    ],
};

// Get movements for a pain location (handles comma-separated multi-select)
export function getMovementsForPain(painLocation: string, intensity: number = 3): Movement[] {
    const locations = painLocation.toLowerCase().split(', ').map(s => s.trim());
    const movements: Movement[] = [];
    const seen = new Set<string>();

    for (const location of locations) {
        const locationMovements = DIAGNOSTIC_MOVEMENTS[location] || DIAGNOSTIC_MOVEMENTS['other'];
        for (const movement of locationMovements) {
            if (!seen.has(movement.id)) {
                seen.add(movement.id);
                movements.push(movement);
            }
        }
    }

    // Return up to 'intensity' movements
    return movements.slice(0, intensity);
}
