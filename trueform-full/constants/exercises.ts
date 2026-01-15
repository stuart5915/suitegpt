/**
 * Exercise Catalog for TrueForm AI
 * 
 * This catalog constrains the AI to only recommend exercises from this curated list.
 * Each exercise has:
 * - id: unique identifier matching image filename
 * - name: display name
 * - keywords: terms the AI uses to match recommendations
 * - category: body region/type
 * - difficulty: clinical progression level
 * - type: stretch (flexibility), strengthening (muscle building), or mobility (joint ROM)
 * - description: brief instruction for the user
 */

export interface Exercise {
    id: string;
    name: string;
    keywords: string[];
    category: 'neck' | 'shoulder' | 'upper_back' | 'core' | 'lower_back' | 'hip' | 'lower_body' | 'wrist';
    difficulty: 'gentle' | 'moderate' | 'challenging';
    type: 'stretch' | 'strengthening' | 'mobility';
    description: string;
}

// Helper to generate YouTube search URL for any exercise
export const getExerciseVideoUrl = (exerciseName: string): string => {
    const searchQuery = encodeURIComponent(`${exerciseName} exercise physical therapy how to`);
    return `https://www.youtube.com/results?search_query=${searchQuery}`;
};

// Image imports - require() for React Native bundling
export const exerciseImages: Record<string, any> = {
    ankle_circles: require('../assets/exercises/exercise_ankle_circles.png'),
    band_external_rotations: require('../assets/exercises/exercise_band_external_rotations.png'),
    band_internal_rotations: require('../assets/exercises/exercise_band_internal_rotations.png'),
    bird_dog: require('../assets/exercises/exercise_bird_dog.png'),
    calf_raises: require('../assets/exercises/exercise_calf_raises.png'),
    cat_cow_stretch: require('../assets/exercises/exercise_cat_cow_stretch.png'),
    childs_pose: require('../assets/exercises/exercise_childs_pose.png'),
    chin_tucks: require('../assets/exercises/exercise_chin_tucks.png'),
    clamshells: require('../assets/exercises/exercise_clamshells.png'),
    cobra_stretch: require('../assets/exercises/exercise_cobra_stretch.png'),
    cross_body_stretch: require('../assets/exercises/exercise_cross_body_stretch.png'),
    dead_bug: require('../assets/exercises/exercise_dead_bug.png'),
    doorway_stretch: require('../assets/exercises/exercise_doorway_stretch.png'),
    face_pulls: require('../assets/exercises/exercise_face_pulls.png'),
    figure_4_stretch: require('../assets/exercises/exercise_figure_4_stretch.png'),
    foam_roller_thoracic: require('../assets/exercises/exercise_foam_roller_thoracic.png'),
    forearm_stretch: require('../assets/exercises/exercise_forearm_stretch.png'),
    glute_bridge: require('../assets/exercises/exercise_glute_bridge.png'),
    hamstring_stretch: require('../assets/exercises/exercise_hamstring_stretch.png'),
    heel_slides: require('../assets/exercises/exercise_heel_slides.png'),
    hip_circles: require('../assets/exercises/exercise_hip_circles.png'),
    hip_flexor_stretch: require('../assets/exercises/exercise_hip_flexor_stretch.png'),
    knees_to_chest: require('../assets/exercises/exercise_knees_to_chest.png'),
    levator_scapulae_stretch: require('../assets/exercises/exercise_levator_scapulae_stretch.png'),
    mcgill_curl_up: require('../assets/exercises/exercise_mcgill_curl_up.png'),
    neck_side_stretch: require('../assets/exercises/exercise_neck_side_stretch.png'),
    pelvic_tilts: require('../assets/exercises/exercise_pelvic_tilts.png'),
    pendulum_swings: require('../assets/exercises/exercise_pendulum_swings.png'),
    plank: require('../assets/exercises/exercise_plank.png'),
    prone_i_raises: require('../assets/exercises/exercise_prone_i_raises.png'),
    prone_t_raises: require('../assets/exercises/exercise_prone_t_raises.png'),
    prone_y_raises: require('../assets/exercises/exercise_prone_y_raises.png'),
    quad_stretch: require('../assets/exercises/exercise_quad_stretch.png'),
    scapular_squeezes: require('../assets/exercises/exercise_scapular_squeezes.png'),
    scapular_wall_slides: require('../assets/exercises/exercise_scapular_wall_slides.png'),
    shoulder_shrugs: require('../assets/exercises/exercise_shoulder_shrugs.png'),
    side_plank: require('../assets/exercises/exercise_side_plank.png'),
    single_leg_balance: require('../assets/exercises/exercise_single_leg_balance.png'),
    sleeper_stretch: require('../assets/exercises/exercise_sleeper_stretch.png'),
    standing_hip_abduction: require('../assets/exercises/exercise_standing_hip_abduction.png'),
    straight_leg_raises: require('../assets/exercises/exercise_straight_leg_raises.png'),
    supine_spinal_twist: require('../assets/exercises/exercise_supine_spinal_twist.png'),
    terminal_knee_extensions: require('../assets/exercises/exercise_terminal_knee_extensions.png'),
    wall_sits: require('../assets/exercises/exercise_wall_sits.png'),
    wrist_circles: require('../assets/exercises/exercise_wrist_circles.png'),
    // New mobility exercises (images being generated)
    shoulder_cars: require('../assets/exercises/exercise_shoulder_cars.png'),
    hip_90_90: require('../assets/exercises/exercise_hip_90_90.png'),
    thoracic_rotation: require('../assets/exercises/exercise_thoracic_rotation.png'),
    thread_the_needle: require('../assets/exercises/exercise_thread_the_needle.png'),
    // New stretch exercises
    world_greatest_stretch: require('../assets/exercises/exercise_world_greatest_stretch.png'),
    chest_stretch: require('../assets/exercises/exercise_chest_stretch.png'),
    it_band_stretch: require('../assets/exercises/exercise_it_band_stretch.png'),
    calf_stretch: require('../assets/exercises/exercise_calf_stretch.png'),
    seated_twist: require('../assets/exercises/exercise_seated_twist.png'),
    lat_stretch: require('../assets/exercises/exercise_lat_stretch.png'),
};

export const EXERCISE_CATALOG: Exercise[] = [
    // === NECK (3) - All stretches/mobility ===
    {
        id: 'chin_tucks',
        name: 'Chin Tucks',
        keywords: ['chin tuck', 'neck posture', 'forward head', 'cervical retraction'],
        category: 'neck',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Pull chin straight back, creating a "double chin". Hold 5 seconds, repeat 10 times.',
        externalUrl: 'https://www.youtube.com/watch?v=wQylqaCl8Zo', // Bob & Brad PT
    },
    {
        id: 'neck_side_stretch',
        name: 'Neck Side Stretch',
        keywords: ['neck stretch', 'lateral neck', 'upper trap stretch', 'neck tension'],
        category: 'neck',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Tilt ear toward shoulder, gently assist with hand. Hold 30 seconds each side.',
        externalUrl: 'https://www.youtube.com/watch?v=OgXe8xqfJXQ',
    },
    {
        id: 'levator_scapulae_stretch',
        name: 'Levator Scapulae Stretch',
        keywords: ['levator', 'neck shoulder junction', 'upper back tension'],
        category: 'neck',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Rotate head 45°, drop chin toward armpit. Hold 30 seconds each side.',
        externalUrl: 'https://www.physio-pedia.com/Levator_Scapulae',
    },

    // === SHOULDER (12) ===
    {
        id: 'band_external_rotations',
        name: 'Band External Rotations',
        keywords: ['external rotation', 'rotator cuff', 'infraspinatus', 'shoulder stability'],
        category: 'shoulder',
        difficulty: 'challenging',
        type: 'strengthening',
        description: 'Elbow at side, rotate forearm outward against band. 3 sets of 15.',
        externalUrl: 'https://exrx.net/WeightExercises/Infraspinatus/CBExternalRotation',
    },
    {
        id: 'band_internal_rotations',
        name: 'Band Internal Rotations',
        keywords: ['internal rotation', 'rotator cuff', 'subscapularis'],
        category: 'shoulder',
        difficulty: 'challenging',
        type: 'strengthening',
        description: 'Elbow at side, rotate forearm inward against band. 3 sets of 15.',
        externalUrl: 'https://exrx.net/WeightExercises/Subscapularis/CBInternalRotation',
    },
    {
        id: 'scapular_wall_slides',
        name: 'Scapular Wall Slides',
        keywords: ['wall slides', 'scapular control', 'shoulder blade', 'posture'],
        category: 'shoulder',
        difficulty: 'moderate',
        type: 'mobility',
        description: 'Back against wall, slide arms up and down keeping contact. 3 sets of 10.',
        externalUrl: 'https://www.youtube.com/watch?v=d6V2Exzb324',
    },
    {
        id: 'prone_y_raises',
        name: 'Prone Y Raises',
        keywords: ['y raise', 'lower trap', 'scapular stability', 'prone raise'],
        category: 'shoulder',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Lie face down, raise arms in Y shape with thumbs up. 3 sets of 10.',
        externalUrl: 'https://exrx.net/WeightExercises/TrapeziusLower/BWProneY',
    },
    {
        id: 'prone_t_raises',
        name: 'Prone T Raises',
        keywords: ['t raise', 'middle trap', 'rhomboids', 'prone raise'],
        category: 'shoulder',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Lie face down, raise arms out to sides in T shape. 3 sets of 10.',
        externalUrl: 'https://exrx.net/WeightExercises/TrapeziusMiddle/BWProneT',
    },
    {
        id: 'prone_i_raises',
        name: 'Prone I Raises',
        keywords: ['i raise', 'overhead stability', 'prone raise'],
        category: 'shoulder',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Lie face down, raise arms straight overhead. 3 sets of 10.',
        externalUrl: 'https://exrx.net/WeightExercises/DeltoidAnterior/BWProneI',
    },
    {
        id: 'face_pulls',
        name: 'Face Pulls',
        keywords: ['face pull', 'rear delt', 'external rotation', 'posture'],
        category: 'shoulder',
        difficulty: 'challenging',
        type: 'strengthening',
        description: 'Pull band to face height, elbows high, squeeze shoulder blades. 3 sets of 15.',
        externalUrl: 'https://exrx.net/WeightExercises/DeltoidPosterior/CBFacePull',
    },
    {
        id: 'scapular_squeezes',
        name: 'Scapular Squeezes',
        keywords: ['scapular squeeze', 'rhomboids', 'posture', 'shoulder blade'],
        category: 'shoulder',
        difficulty: 'gentle',
        type: 'strengthening',
        description: 'Squeeze shoulder blades together and hold 5 seconds. Repeat 10 times.',
        externalUrl: 'https://www.physio-pedia.com/Scapular_Stabilization_Exercise',
    },
    {
        id: 'pendulum_swings',
        name: 'Pendulum Swings',
        keywords: ['pendulum', 'shoulder mobility', 'frozen shoulder', 'codman'],
        category: 'shoulder',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Lean forward, let arm hang and swing in small circles. 1-2 minutes.',
        externalUrl: 'https://www.physio-pedia.com/Codman_Pendulum_Exercises',
    },
    {
        id: 'sleeper_stretch',
        name: 'Sleeper Stretch',
        keywords: ['sleeper stretch', 'internal rotation', 'posterior capsule'],
        category: 'shoulder',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Lie on side, gently push forearm down. Hold 30 seconds.',
        externalUrl: 'https://www.youtube.com/watch?v=P-fVz4HvPac',
    },
    {
        id: 'cross_body_stretch',
        name: 'Cross-Body Stretch',
        keywords: ['cross body', 'posterior shoulder', 'shoulder stretch'],
        category: 'shoulder',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Pull arm across chest with opposite hand. Hold 30 seconds each side.',
        externalUrl: 'https://exrx.net/Stretches/DeltoidPosterior/CrossBodyShoulder',
    },
    {
        id: 'doorway_stretch',
        name: 'Doorway Stretch',
        keywords: ['doorway stretch', 'pec stretch', 'chest opener', 'anterior shoulder'],
        category: 'shoulder',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Forearm on doorframe, lean through until chest stretch. Hold 30 seconds.',
        externalUrl: 'https://exrx.net/Stretches/PectoralisMinor/DoorwayStretch',
    },
    {
        id: 'shoulder_shrugs',
        name: 'Shoulder Shrugs',
        keywords: ['shrug', 'upper trap', 'shoulder elevation'],
        category: 'shoulder',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Raise shoulders toward ears, hold 2 seconds, release. 3 sets of 15.',
        externalUrl: 'https://exrx.net/WeightExercises/TrapeziusUpper/BBShrug',
    },

    // === UPPER BACK (2) ===
    {
        id: 'foam_roller_thoracic',
        name: 'Foam Roller Thoracic Extension',
        keywords: ['foam roller', 'thoracic extension', 'upper back mobility', 't-spine'],
        category: 'upper_back',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Lie on roller at upper back, extend backward over it. 10 extensions.',
        externalUrl: 'https://www.youtube.com/watch?v=SxQkVJxXzMk',
    },
    {
        id: 'cat_cow_stretch',
        name: 'Cat-Cow Stretch',
        keywords: ['cat cow', 'spinal mobility', 'back stretch', 'flexion extension'],
        category: 'upper_back',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'On all fours, alternate arching and rounding spine. 10 cycles.',
        externalUrl: 'https://www.youtube.com/watch?v=kqnua4rHVVA', // Physio-approved demo
    },

    // === CORE (6) ===
    {
        id: 'dead_bug',
        name: 'Dead Bug',
        keywords: ['dead bug', 'core stability', 'anti-extension', 'abdominal'],
        category: 'core',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Lie on back, extend opposite arm/leg while keeping back flat. 3 sets of 10 each side.',
        externalUrl: 'https://exrx.net/WeightExercises/RectusAbdominis/BWDeadBug',
    },
    {
        id: 'bird_dog',
        name: 'Bird Dog',
        keywords: ['bird dog', 'core stability', 'back extension', 'quadruped'],
        category: 'core',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'On all fours, extend opposite arm/leg, hold 3 seconds. 3 sets of 10 each side.',
        externalUrl: 'https://exrx.net/WeightExercises/ErectorSpinae/BWBirdDog',
    },
    {
        id: 'plank',
        name: 'Plank',
        keywords: ['plank', 'core endurance', 'isometric', 'abdominal'],
        category: 'core',
        difficulty: 'challenging',
        type: 'strengthening',
        description: 'Hold body straight on forearms and toes. Build to 60 seconds.',
        externalUrl: 'https://exrx.net/WeightExercises/RectusAbdominis/BWFrontPlank',
    },
    {
        id: 'side_plank',
        name: 'Side Plank',
        keywords: ['side plank', 'obliques', 'lateral core', 'hip stability'],
        category: 'core',
        difficulty: 'challenging',
        type: 'strengthening',
        description: 'Support body on side, forearm and feet stacked. Hold 30 seconds each side.',
        externalUrl: 'https://exrx.net/WeightExercises/Obliques/BWSidePlank',
    },
    {
        id: 'mcgill_curl_up',
        name: 'McGill Curl-Up',
        keywords: ['mcgill', 'curl up', 'abdominal', 'low back safe'],
        category: 'core',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Hands under lower back, lift head/shoulders slightly. Hold 10 seconds, 5 reps.',
        externalUrl: 'https://www.youtube.com/watch?v=6NjBhV9YqHA',
    },
    {
        id: 'pelvic_tilts',
        name: 'Pelvic Tilts',
        keywords: ['pelvic tilt', 'lumbar control', 'core activation', 'lower back'],
        category: 'core',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Lie on back, flatten lower back into floor, release. 3 sets of 15.',
        externalUrl: 'https://www.physio-pedia.com/Pelvic_Tilt_Exercises',
    },

    // === LOWER BACK (4) ===
    {
        id: 'knees_to_chest',
        name: 'Knees to Chest Stretch',
        keywords: ['knees to chest', 'lower back stretch', 'lumbar flexion'],
        category: 'lower_back',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Lying on back, hug both knees to chest. Hold 30 seconds.',
        externalUrl: 'https://www.youtube.com/watch?v=0TVN1mpqNno',
    },
    {
        id: 'supine_spinal_twist',
        name: 'Supine Spinal Twist',
        keywords: ['spinal twist', 'rotation', 'lower back mobility'],
        category: 'lower_back',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Knees together, drop to one side while keeping shoulders flat. Hold 30 seconds each.',
        externalUrl: 'https://exrx.net/Stretches/ErectorSpinae/SupineSpinalTwist',
    },
    {
        id: 'cobra_stretch',
        name: 'Cobra Stretch',
        keywords: ['cobra', 'back extension', 'lumbar extension', 'mckenzie'],
        category: 'lower_back',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Lie face down, push up on hands keeping hips down. Hold 10 seconds, 10 reps.',
        externalUrl: 'https://www.physio-pedia.com/McKenzie_Exercises',
    },
    {
        id: 'childs_pose',
        name: "Child's Pose",
        keywords: ['childs pose', 'back stretch', 'relaxation', 'lumbar flexion'],
        category: 'lower_back',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Sit back on heels, reach arms forward, relax. Hold 30-60 seconds.',
        externalUrl: 'https://www.youtube.com/watch?v=eH7bStTqxSU',
    },

    // === HIP (7) ===
    {
        id: 'glute_bridge',
        name: 'Glute Bridge',
        keywords: ['glute bridge', 'hip extension', 'glute activation', 'posterior chain'],
        category: 'hip',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Lie on back, push hips up squeezing glutes. 3 sets of 15.',
        externalUrl: 'https://exrx.net/WeightExercises/GluteusMaximus/BWGluteBridge',
    },
    {
        id: 'clamshells',
        name: 'Clamshells',
        keywords: ['clamshell', 'glute med', 'hip abduction', 'hip stability'],
        category: 'hip',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Lie on side, knees bent, lift top knee keeping feet together. 3 sets of 15.',
        externalUrl: 'https://exrx.net/WeightExercises/HipAbductor/BWLyingClamshell',
    },
    {
        id: 'hip_flexor_stretch',
        name: 'Hip Flexor Stretch',
        keywords: ['hip flexor', 'psoas stretch', 'lunge stretch', 'anterior hip'],
        category: 'hip',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Kneeling lunge, push hips forward. Hold 30 seconds each side.',
        externalUrl: 'https://exrx.net/Stretches/HipFlexors/KneelingHipFlexor',
    },
    {
        id: 'figure_4_stretch',
        name: 'Figure-4 Stretch',
        keywords: ['figure 4', 'piriformis', 'glute stretch', 'hip external rotation'],
        category: 'hip',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Lie on back, cross ankle over knee, pull thigh toward chest. Hold 30 seconds.',
        externalUrl: 'https://www.youtube.com/watch?v=b3M4aLPvJLo',
    },
    {
        id: 'hip_circles',
        name: 'Hip Circles',
        keywords: ['hip circle', 'hip mobility', 'hip rotation'],
        category: 'hip',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Standing on one leg, circle other knee in large circles. 10 each direction.',
        externalUrl: 'https://www.youtube.com/watch?v=ePxMEK3lEQg',
    },
    {
        id: 'standing_hip_abduction',
        name: 'Standing Hip Abduction',
        keywords: ['hip abduction', 'glute med', 'lateral hip'],
        category: 'hip',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Holding support, lift leg out to side. 3 sets of 15 each leg.',
        externalUrl: 'https://exrx.net/WeightExercises/HipAbductor/BWStandingHipAbduction',
    },
    {
        id: 'single_leg_balance',
        name: 'Single Leg Balance',
        keywords: ['balance', 'proprioception', 'ankle stability', 'single leg'],
        category: 'hip',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Stand on one leg, hold 30 seconds. Progress to eyes closed.',
        externalUrl: 'https://www.physio-pedia.com/Balance_Training',
    },

    // === LOWER BODY (8) ===
    {
        id: 'straight_leg_raises',
        name: 'Straight Leg Raises',
        keywords: ['leg raise', 'quad strengthening', 'knee rehab'],
        category: 'lower_body',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Lying on back, lift straight leg to 45°. 3 sets of 15 each leg.',
        externalUrl: 'https://exrx.net/WeightExercises/Quadriceps/BWStraightLegRaise',
    },
    {
        id: 'heel_slides',
        name: 'Heel Slides',
        keywords: ['heel slide', 'knee flexion', 'knee mobility', 'post-surgery'],
        category: 'lower_body',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Lying on back, slide heel toward buttock. 3 sets of 15 each leg.',
        externalUrl: 'https://www.physio-pedia.com/Knee_Range_of_Motion_Exercises',
    },
    {
        id: 'terminal_knee_extensions',
        name: 'Terminal Knee Extensions',
        keywords: ['terminal extension', 'quad', 'VMO', 'knee stability'],
        category: 'lower_body',
        difficulty: 'challenging',
        type: 'strengthening',
        description: 'Band behind knee, straighten fully against resistance. 3 sets of 15.',
        externalUrl: 'https://www.youtube.com/watch?v=fFAMMG3xNfE',
    },
    {
        id: 'wall_sits',
        name: 'Wall Sits',
        keywords: ['wall sit', 'quad endurance', 'isometric', 'knee strengthening'],
        category: 'lower_body',
        difficulty: 'challenging',
        type: 'strengthening',
        description: 'Back against wall, slide down to 90° knee bend. Hold 30-60 seconds.',
        externalUrl: 'https://exrx.net/WeightExercises/Quadriceps/BWWallSit',
    },
    {
        id: 'calf_raises',
        name: 'Calf Raises',
        keywords: ['calf raise', 'ankle strengthening', 'gastrocnemius', 'achilles'],
        category: 'lower_body',
        difficulty: 'moderate',
        type: 'strengthening',
        description: 'Rise up onto toes, lower slowly. 3 sets of 15.',
        externalUrl: 'https://exrx.net/WeightExercises/Gastrocnemius/BWStandingCalfRaise',
    },
    {
        id: 'ankle_circles',
        name: 'Ankle Circles',
        keywords: ['ankle circle', 'ankle mobility', 'foot mobility'],
        category: 'lower_body',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Circle ankle slowly in both directions. 10 circles each way.',
        externalUrl: 'https://www.physio-pedia.com/Ankle_Exercises',
    },
    {
        id: 'quad_stretch',
        name: 'Quad Stretch',
        keywords: ['quad stretch', 'quadriceps', 'thigh stretch'],
        category: 'lower_body',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Standing, pull foot toward buttock. Hold 30 seconds each leg.',
        externalUrl: 'https://exrx.net/Stretches/Quadriceps/SQStanding',
    },
    {
        id: 'hamstring_stretch',
        name: 'Hamstring Stretch',
        keywords: ['hamstring stretch', 'posterior thigh', 'leg stretch'],
        category: 'lower_body',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Leg extended, hinge forward at hips. Hold 30 seconds each leg.',
        externalUrl: 'https://exrx.net/Stretches/Hamstrings/SHStanding',
    },

    // === WRIST (2) ===
    {
        id: 'wrist_circles',
        name: 'Wrist Circles',
        keywords: ['wrist circle', 'wrist mobility', 'carpal'],
        category: 'wrist',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'Circle wrists slowly in both directions. 10 circles each way.',
        externalUrl: 'https://www.physio-pedia.com/Wrist_Exercises',
    },
    {
        id: 'forearm_stretch',
        name: 'Forearm Stretch',
        keywords: ['forearm stretch', 'wrist flexor', 'carpal tunnel', 'computer strain'],
        category: 'wrist',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Extend arm, pull fingers back with other hand. Hold 30 seconds each arm.',
        externalUrl: 'https://exrx.net/Stretches/FlexorCarpiRadialis/WristFlexorStretch',
    },

    // === NEW MOBILITY EXERCISES ===
    {
        id: 'shoulder_cars',
        name: 'Shoulder CARs',
        keywords: ['controlled articular rotation', 'shoulder mobility', 'joint health', 'cars'],
        category: 'shoulder',
        difficulty: 'moderate',
        type: 'mobility',
        description: 'Standing tall, slowly rotate shoulder through full range of motion. 5 circles each direction.',
        externalUrl: 'https://www.youtube.com/watch?v=nOsVGGJRop4',
    },
    {
        id: 'hip_90_90',
        name: 'Hip 90/90',
        keywords: ['90 90', 'hip mobility', 'internal rotation', 'external rotation'],
        category: 'hip',
        difficulty: 'moderate',
        type: 'mobility',
        description: 'Sit with both legs bent at 90°, rotate hips side to side. 10 transitions.',
        externalUrl: 'https://www.youtube.com/watch?v=R-wDoUyQ5cQ',
    },
    {
        id: 'thoracic_rotation',
        name: 'Thoracic Rotation',
        keywords: ['thoracic', 'spine rotation', 't-spine mobility', 'twist'],
        category: 'upper_back',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'On all fours, place hand behind head, rotate toward ceiling. 10 each side.',
        externalUrl: 'https://www.youtube.com/watch?v=vkHfMVNadYc',
    },
    {
        id: 'world_greatest_stretch',
        name: 'World\'s Greatest Stretch',
        keywords: ['greatest stretch', 'hip opener', 'thoracic', 'full body'],
        category: 'hip',
        difficulty: 'moderate',
        type: 'mobility',
        description: 'Deep lunge, elbow to instep, rotate toward front leg. Hold 30 seconds each side.',
        externalUrl: 'https://www.youtube.com/watch?v=JXKC4oCNLRU',
    },
    {
        id: 'thread_the_needle',
        name: 'Thread the Needle',
        keywords: ['thread needle', 'thoracic rotation', 'upper back stretch'],
        category: 'upper_back',
        difficulty: 'gentle',
        type: 'mobility',
        description: 'On all fours, thread arm under body, rotating spine. Hold 20 seconds each side.',
        externalUrl: 'https://www.youtube.com/watch?v=UDCz-Q8Y3cc',
    },

    // === NEW STRETCHES ===
    {
        id: 'chest_stretch',
        name: 'Chest Stretch',
        keywords: ['chest stretch', 'pec major', 'posture', 'anterior shoulder'],
        category: 'shoulder',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Clasp hands behind back, squeeze shoulder blades, lift arms. Hold 30 seconds.',
        externalUrl: 'https://exrx.net/Stretches/PectoralisMajor/ChestStretch',
    },
    {
        id: 'it_band_stretch',
        name: 'IT Band Stretch',
        keywords: ['it band', 'iliotibial', 'lateral thigh', 'knee pain'],
        category: 'lower_body',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Cross legs, lean away from back leg. Hold 30 seconds each side.',
        externalUrl: 'https://www.youtube.com/watch?v=rdG78gVN3J8',
    },
    {
        id: 'calf_stretch',
        name: 'Calf Stretch',
        keywords: ['calf stretch', 'gastrocnemius', 'soleus', 'achilles'],
        category: 'lower_body',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Step back, press heel into ground with straight leg. Hold 30 seconds each side.',
        externalUrl: 'https://exrx.net/Stretches/Gastrocnemius/Wall',
    },
    {
        id: 'seated_twist',
        name: 'Seated Spinal Twist',
        keywords: ['seated twist', 'spine rotation', 'lower back stretch'],
        category: 'lower_back',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Sit cross-legged, twist torso, use arm for gentle leverage. Hold 30 seconds each side.',
        externalUrl: 'https://www.youtube.com/watch?v=SVqfPQz0WPo',
    },
    {
        id: 'lat_stretch',
        name: 'Lat Stretch',
        keywords: ['lat stretch', 'latissimus', 'side stretch', 'arm overhead'],
        category: 'upper_back',
        difficulty: 'gentle',
        type: 'stretch',
        description: 'Reach one arm overhead, lean to opposite side. Hold 30 seconds each side.',
        externalUrl: 'https://exrx.net/Stretches/LatissimusDorsi/OverheadLat',
    },
];

// Helper function to get exercise by ID
export const getExerciseById = (id: string): Exercise | undefined => {
    return EXERCISE_CATALOG.find(ex => ex.id === id);
};

// Helper function to get image for exercise
export const getExerciseImage = (id: string): any => {
    return exerciseImages[id] || null;
};

// Helper function to match AI recommendation to exercise
export const matchExerciseFromText = (text: string): Exercise | null => {
    const lowerText = text.toLowerCase();

    // First try exact name match
    const exactMatch = EXERCISE_CATALOG.find(ex =>
        lowerText.includes(ex.name.toLowerCase())
    );
    if (exactMatch) return exactMatch;

    // Then try keyword matching
    const keywordMatch = EXERCISE_CATALOG.find(ex =>
        ex.keywords.some(kw => lowerText.includes(kw.toLowerCase()))
    );
    if (keywordMatch) return keywordMatch;

    return null;
};

// Generate the list of exercise names for AI prompt
export const getExerciseNamesForPrompt = (): string => {
    return EXERCISE_CATALOG.map(ex => ex.name).join(', ');
};

// Get exercises by type for AI prompt
export const getExercisesByTypeForPrompt = (type: 'stretch' | 'strengthening' | 'mobility'): string => {
    return EXERCISE_CATALOG
        .filter(ex => ex.type === type)
        .map(ex => ex.name)
        .join(', ');
};

// Helper function to get exercises by type
export const getExercisesByType = (type: 'stretch' | 'strengthening' | 'mobility'): Exercise[] => {
    return EXERCISE_CATALOG.filter(ex => ex.type === type);
};

// Helper function to get exercises by difficulty level(s)
// Used for phase-based plan generation
export const getExercisesByDifficulty = (
    difficulties: ('gentle' | 'moderate' | 'challenging')[],
    category?: string
): Exercise[] => {
    return EXERCISE_CATALOG.filter(ex => {
        const matchesDifficulty = difficulties.includes(ex.difficulty);
        const matchesCategory = !category || ex.category === category;
        return matchesDifficulty && matchesCategory;
    });
};

// Phase-to-difficulty mapping for clinical progression
export const PHASE_DIFFICULTY_MAP: Record<string, ('gentle' | 'moderate' | 'challenging')[]> = {
    acute: ['gentle'],
    subacute: ['gentle', 'moderate'],
    strengthening: ['gentle', 'moderate', 'challenging'],
    maintenance: ['gentle', 'moderate', 'challenging'],
};
