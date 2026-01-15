import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Image,
    ScrollView,
    Alert,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    TouchableWithoutFeedback,
    Modal,
    Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { analyzeFramesWithPrompt } from '../services/geminiHybridService';
import { saveMovementReport, getCurrentUser, getHealthProfile } from '../services/supabase';
import { getExercisesByTypeForPrompt } from '../constants/exercises';

// Optional: expo-image-manipulator requires dev build, not available in Expo Go
let ImageManipulator: typeof import('expo-image-manipulator') | null = null;
try {
    ImageManipulator = require('expo-image-manipulator');
} catch (e) {
    console.log('[THUMBNAILS] expo-image-manipulator not available (requires dev build)');
}

interface RecordedFrame {
    uri: string;
    timestamp: number;
}

interface Movement {
    id: string;
    name: string;
    emoji: string;
}

interface Recording {
    movement: Movement;
    frames: RecordedFrame[];
    duration: number;
}

interface PainPoint {
    recordingIndex: number;
    frameIndex: number;
    x: number;
    y: number;
    intensity: number;
    notes?: string;
}

export default function ReviewScreen() {
    const params = useLocalSearchParams();

    // Parse session data (decodeURIComponent to handle special characters in text fields)
    const sessionData = params.sessionData ? JSON.parse(decodeURIComponent(params.sessionData as string)) : null;
    const recordings: Recording[] = sessionData?.recordings || [];
    const questionnaire = sessionData?.questionnaire || {};
    const scanIntensity = sessionData?.scanIntensity || 1;

    const [currentRecordingIndex, setCurrentRecordingIndex] = useState(0);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
    // Track pain point frame per recording for navigation memory
    const [recordingPainFrames, setRecordingPainFrames] = useState<{ [key: number]: number }>({});
    const [showPainConfirmation, setShowPainConfirmation] = useState(false);
    const [selectedIntensity, setSelectedIntensity] = useState(5);
    const [currentNotes, setCurrentNotes] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showNoPainPointsModal, setShowNoPainPointsModal] = useState(false);

    const currentRecording = recordings[currentRecordingIndex];
    const currentFrame = currentRecording?.frames[currentFrameIndex];
    const totalFrames = currentRecording?.frames.length || 0;

    // Check if current recording has a pain point marked
    const currentRecordingPainPoint = painPoints.find(
        p => p.frameIndex === recordingPainFrames[currentRecordingIndex]
    );

    // Handle image tap to mark pain point
    const handleImagePress = (event: any) => {
        const { locationX, locationY } = event.nativeEvent;

        const newPainPoint: PainPoint = {
            recordingIndex: currentRecordingIndex,
            frameIndex: currentFrameIndex,
            x: locationX,
            y: locationY,
            intensity: selectedIntensity,
            notes: currentNotes || undefined,
        };

        // Replace any existing pain point on this recording+frame (only one per frame per recording)
        setPainPoints(prev => {
            const filtered = prev.filter(p =>
                !(p.recordingIndex === currentRecordingIndex && p.frameIndex === currentFrameIndex)
            );
            return [...filtered, newPainPoint];
        });

        // Remember this frame as the pain point frame for this recording
        setRecordingPainFrames(prev => ({
            ...prev,
            [currentRecordingIndex]: currentFrameIndex
        }));
    };

    // Navigate frames - load existing notes if any
    const goToPrevFrame = () => {
        if (currentFrameIndex > 0) {
            const newIndex = currentFrameIndex - 1;
            setCurrentFrameIndex(newIndex);
            loadNotesForFrame(newIndex);
        }
    };

    const goToNextFrame = () => {
        if (currentFrameIndex < totalFrames - 1) {
            const newIndex = currentFrameIndex + 1;
            setCurrentFrameIndex(newIndex);
            loadNotesForFrame(newIndex);
        }
    };

    const loadNotesForFrame = (frameIdx: number) => {
        const existing = painPoints.find(p => p.frameIndex === frameIdx);
        setCurrentNotes(existing?.notes || '');
        if (existing) {
            setSelectedIntensity(existing.intensity);
        }
    };

    // Navigate recordings - remember pain point frame
    const goToPrevRecording = () => {
        if (currentRecordingIndex > 0) {
            const prevIndex = currentRecordingIndex - 1;
            setCurrentRecordingIndex(prevIndex);
            // Jump to pain point frame if one exists, otherwise frame 0
            const painFrame = recordingPainFrames[prevIndex];
            setCurrentFrameIndex(painFrame !== undefined ? painFrame : 0);
            setShowPainConfirmation(false);
        }
    };

    const goToNextRecording = () => {
        if (currentRecordingIndex < recordings.length - 1) {
            const nextIndex = currentRecordingIndex + 1;
            setCurrentRecordingIndex(nextIndex);
            // Jump to pain point frame if one exists, otherwise frame 0
            const painFrame = recordingPainFrames[nextIndex];
            setCurrentFrameIndex(painFrame !== undefined ? painFrame : 0);
            setShowPainConfirmation(false);
        }
    };

    // Confirm pain point and auto-advance to next recording
    const confirmPainPoint = () => {
        setShowPainConfirmation(false);
        // Auto-advance to next recording if there is one
        if (currentRecordingIndex < recordings.length - 1) {
            goToNextRecording();
        }
    };

    // Go back to adjust the pain point
    const adjustPainPoint = () => {
        setShowPainConfirmation(false);
    };

    // Create tiny thumbnails centered around pain point
    const createThumbnails = async (frames: RecordedFrame[], painPointFrameIndex: number): Promise<string[]> => {
        const thumbnails: string[] = [];
        const numThumbnails = 10;
        const halfRange = Math.floor(numThumbnails / 2);

        // Calculate frame indices: 5 before pain point, pain point, 4 after
        const startIndex = Math.max(0, painPointFrameIndex - halfRange);
        const endIndex = Math.min(frames.length - 1, painPointFrameIndex + halfRange - 1);

        // If we're at the edge, adjust to still get 10 frames if possible
        let indicesToCapture: number[] = [];
        for (let i = startIndex; i <= endIndex && indicesToCapture.length < numThumbnails; i++) {
            indicesToCapture.push(i);
        }

        // If we don't have enough, pad from the other direction
        if (indicesToCapture.length < numThumbnails && startIndex > 0) {
            for (let i = startIndex - 1; i >= 0 && indicesToCapture.length < numThumbnails; i--) {
                indicesToCapture.unshift(i);
            }
        }
        if (indicesToCapture.length < numThumbnails && endIndex < frames.length - 1) {
            for (let i = endIndex + 1; i < frames.length && indicesToCapture.length < numThumbnails; i++) {
                indicesToCapture.push(i);
            }
        }

        console.log(`[THUMBNAILS] Capturing ${indicesToCapture.length} frames around pain point at index ${painPointFrameIndex}`);

        // Check if ImageManipulator is available (not in Expo Go)
        if (!ImageManipulator) {
            console.log('[THUMBNAILS] Skipping - ImageManipulator not available in Expo Go');
            return thumbnails;
        }

        for (const idx of indicesToCapture) {
            try {
                const frame = frames[idx];
                // Resize to tiny thumbnail (100x75) and compress heavily
                const manipulated = await ImageManipulator.manipulateAsync(
                    frame.uri,
                    [{ resize: { width: 100, height: 75 } }],
                    { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (manipulated.base64) {
                    thumbnails.push(manipulated.base64);
                }
            } catch (error) {
                console.warn(`[THUMBNAILS] Failed to process frame ${idx}:`, error);
            }
        }

        console.log(`[THUMBNAILS] Created ${thumbnails.length} thumbnails`);
        return thumbnails;
    };

    // Generate AI report
    const generateReport = async () => {
        if (painPoints.length === 0) {
            setShowNoPainPointsModal(true);
            return;
        }

        if (!recordings || recordings.length === 0) {
            Alert.alert('No Recordings', 'No recording data available.');
            return;
        }

        const recording = recordings[currentRecordingIndex];
        if (!recording || !recording.frames || recording.frames.length === 0) {
            Alert.alert('No Frames', 'This recording has no frames.');
            return;
        }

        setIsAnalyzing(true);
        setLoadingPhase(0);

        // Update loading phase every 3 seconds for visual feedback
        const phaseInterval = setInterval(() => {
            setLoadingPhase(prev => prev + 1);
        }, 3000);

        try {
            // Collect frames around each pain point (2-second window)
            const framesToAnalyze: string[] = [];
            const FPS = 5;
            const WINDOW_SECONDS = 2;
            const WINDOW_FRAMES = FPS * WINDOW_SECONDS;
            const totalFrames = recording.frames.length;

            console.log(`[AI] Analyzing ${painPoints.length} pain points from ${totalFrames} frames`);

            for (const painPoint of painPoints) {
                const startIdx = Math.max(0, painPoint.frameIndex - WINDOW_FRAMES);
                const endIdx = Math.min(totalFrames - 1, painPoint.frameIndex + WINDOW_FRAMES);

                console.log(`[AI] Pain point at frame ${painPoint.frameIndex}, collecting frames ${startIdx}-${endIdx}`);

                for (let i = startIdx; i <= endIdx; i++) {
                    if (recording.frames[i] && recording.frames[i].uri) {
                        framesToAnalyze.push(recording.frames[i].uri);
                    }
                }
            }

            // Build AI prompt with structured output format
            // Get categorized exercise lists for AI to use
            const stretchList = getExercisesByTypeForPrompt('stretch');
            const strengthList = getExercisesByTypeForPrompt('strengthening');
            const mobilityList = getExercisesByTypeForPrompt('mobility');

            // Fetch health profile for personalized recommendations
            let healthContext = '';
            try {
                const { user } = await getCurrentUser();
                if (user) {
                    const { data: healthProfile } = await getHealthProfile(user.id);
                    if (healthProfile && healthProfile.health_profile_complete) {
                        const age = healthProfile.birth_year
                            ? new Date().getFullYear() - healthProfile.birth_year
                            : null;
                        healthContext = `
**Physical Profile:**
- Weight: ${healthProfile.weight_lbs || 'Not specified'} lbs
- Height: ${healthProfile.height_inches ? `${Math.floor(healthProfile.height_inches / 12)}'${healthProfile.height_inches % 12}"` : 'Not specified'}
- Age: ${age || 'Not specified'} years
- Activity Level: ${healthProfile.activity_level || 'Not specified'}
- Medical Conditions: ${healthProfile.medical_conditions?.length ? healthProfile.medical_conditions.join(', ') : 'None reported'}

**IMPORTANT PERSONALIZATION:**
- Adjust exercise intensity and difficulty based on the patient's physical profile
- If weight is high, prioritize low-impact and supported exercises
- If age is advanced, focus on gentler progressions
- Consider any medical conditions when recommending exercises
`;
                    }
                }
            } catch (e) {
                console.log('[AI] Could not fetch health profile, proceeding without it');
            }

            const prompt = `You are an expert physiotherapist analyzing movement patterns.
${healthContext}

**Patient Information:**
- Pain Location: ${questionnaire.painLocation?.join(', ') || 'Not specified'}
- Duration: ${questionnaire.painDuration || 'Not specified'}
- Triggers: ${questionnaire.painTrigger?.join(', ') || 'Not specified'}
- Pain Type: ${questionnaire.painType?.join(', ') || 'Not specified'}
- Prior Injuries: ${questionnaire.priorInjuries || 'None'}

**Movement Analyzed:** ${recording.movement.name}

**Pain Points Marked:** ${painPoints.length} (Avg Intensity: ${Math.round(painPoints.reduce((sum, p) => sum + p.intensity, 0) / painPoints.length)}/10)

**IMPORTANT - EXERCISE CONSTRAINT:**
You MUST ONLY recommend exercises from these approved lists. Use the EXACT exercise names as written.

APPROVED STRETCHES: ${stretchList}

APPROVED STRENGTHENING: ${strengthList}

APPROVED MOBILITY: ${mobilityList}

Do NOT suggest any exercises outside these lists.

Analyze the movement frames and provide a structured report in EXACTLY this format:

[TLDR]
One concise sentence summarizing the main finding and recommendation.
[/TLDR]

[TOP_EXERCISE]
**Exercise Name:** Brief description of the single most important exercise to do. MUST be from one of the approved lists above.
[/TOP_EXERCISE]

[SECTION:Movement Analysis]
**Summary:** One sentence overview of the movement quality.

Then provide detailed assessment covering:
- Specific compensations or limitations observed
- Joint alignment issues
- Movement pattern quality
[/SECTION]

[SECTION:Potential Causes]
**Summary:** One sentence identifying the most likely cause.

Then provide detailed analysis:
- Primary contributing factors
- How symptoms connect to movement patterns
- Underlying muscle imbalances or restrictions
[/SECTION]

[SECTION:Recommended Stretches]
List 2-4 stretches from the APPROVED STRETCHES list. Focus on lengthening tight muscles.
Format each as:
**Exercise Name:** Hold duration and brief instruction.
[/SECTION]

[SECTION:Strengthening Exercises]
List 2-4 exercises from the APPROVED STRENGTHENING list. Focus on building supporting muscles.
Format each as:
**Exercise Name:** Sets/reps and brief instruction.
[/SECTION]

[SECTION:Mobility Work]
List 2-3 drills from the APPROVED MOBILITY list. Focus on improving joint range of motion.
Format each as:
**Exercise Name:** Duration/reps and brief instruction.
[/SECTION]

[SECTION:General Advice]
Provide as bullet points:
• First lifestyle or posture tip
• Second recommendation
• Third recommendation
• Additional guidance as needed
[/SECTION]

[SECTION:When to Seek Help]
Clear criteria for when an in-person evaluation is recommended.
[/SECTION]

[PLAN_CONFIG]
Based on the severity and nature of the issues identified, provide a recommended rehab plan configuration:
duration_weeks: (number between 2-8, based on severity)
exercises_per_day: (number between 2-5, based on complexity)
check_in_frequency: (weekly or biweekly)
reasoning: (1 sentence explaining why you chose this duration/frequency)
[/PLAN_CONFIG]

Use **bold** for emphasis on important terms. Be thorough but concise.`;

            const startTime = Date.now();
            const report = await analyzeFramesWithPrompt(framesToAnalyze, prompt);
            const processingTime = Date.now() - startTime;

            // Check if user is authenticated before saving
            console.log('[AI] Checking authentication...');

            // Add timeout to auth check to prevent hanging
            const authPromise = getCurrentUser();
            const timeoutPromise = new Promise<{ user: null; error: { message: string } }>((resolve) =>
                setTimeout(() => resolve({ user: null, error: { message: 'Auth check timed out' } }), 5000)
            );

            const { user, error: authError } = await Promise.race([authPromise, timeoutPromise]);
            console.log('[AI] Auth check completed', user ? 'with user' : 'no user');

            if (authError || !user) {
                console.log('[AI] User not authenticated:', authError?.message);
                Alert.alert(
                    'Login Required',
                    'Please log in to save your movement report. The analysis has completed but cannot be saved without an account.',
                    [
                        { text: 'Go to Login', onPress: () => router.push('/login') },
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
                setIsAnalyzing(false);
                return;
            }

            console.log('[AI] User authenticated:', user.email);

            // Generate thumbnails centered on first pain point
            console.log('[AI] Generating frame thumbnails...');
            let frameThumbnails: string[] = [];
            try {
                const firstPainPoint = painPoints[0];
                frameThumbnails = await createThumbnails(recording.frames, firstPainPoint.frameIndex);
            } catch (thumbError) {
                console.warn('[AI] Thumbnail generation failed, continuing without:', thumbError);
            }

            // Save report to database
            console.log('[AI] Saving report to database...');
            try {
                const { data: savedReport, error: saveError } = await saveMovementReport({
                    movement_name: recording.movement.name,
                    movement_emoji: recording.movement.emoji,
                    duration_seconds: Math.floor(recording.duration / 1000),
                    pain_location: questionnaire.painLocation,
                    pain_duration: questionnaire.painDuration,
                    pain_triggers: questionnaire.painTrigger,
                    pain_type: questionnaire.painType,
                    prior_injuries: questionnaire.priorInjuries,
                    ai_report: report,
                    pain_points_count: painPoints.length,
                    avg_intensity: painPoints.length > 0
                        ? Math.round(painPoints.reduce((sum, p) => sum + p.intensity, 0) / painPoints.length * 10) / 10
                        : 0,
                    frame_count: recording.frames.length,
                    model_used: 'gemini-2.5-flash',
                    processing_time_ms: processingTime,
                    frame_thumbnails: frameThumbnails,
                });

                console.log('[AI] Save completed, checking for errors...');

                if (saveError) {
                    console.error('[AI] Save failed:', saveError);
                    const errorMsg = saveError.message || JSON.stringify(saveError);
                    Alert.alert(
                        'Save Failed',
                        `Report could not be saved.\n\nError: ${errorMsg}\n\n` +
                        'Make sure you ran the database migration in Supabase:\n' +
                        'database/migrations/007_movement_reports.sql'
                    );
                    return;
                }

                console.log('✅ Report saved successfully:', savedReport?.id);
            } catch (dbError: any) {
                console.error('[AI] Database exception:', dbError);
                Alert.alert(
                    'Database Error',
                    `Failed to save report: ${dbError.message || 'Unknown error'}\n\n` +
                    'Make sure the movement_reports table exists in your Supabase database.'
                );
                return;
            }

            // Show success modal
            setShowSuccessModal(true);

        } catch (error: any) {
            Alert.alert('Analysis Failed', error.message || 'Could not generate report');
        } finally {
            clearInterval(phaseInterval);
            setIsAnalyzing(false);
        }
    };

    if (!sessionData || recordings.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>No recording data found</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <SafeAreaView style={styles.container}>
                    {/* Header - Clean minimal nav */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                            <Text style={styles.cancelText}>✕</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity
                            style={[styles.generateBtn, isAnalyzing && styles.generateBtnDisabled]}
                            onPress={generateReport}
                            disabled={isAnalyzing}
                        >
                            <Text style={styles.generateBtnText}>
                                {isAnalyzing ? '⏳ Analyzing...' : '✨ Generate Report'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Scrollable content area */}
                    <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Instructions Header */}
                        <View style={styles.instructionsHeader}>
                            <Text style={styles.instructionsTitle}>📋 Mark Your Pain Point</Text>
                            <View style={styles.instructionSteps}>
                                <Text style={styles.instructionStep}>
                                    <Text style={styles.stepNumber}>1.</Text> Use the slider to find the frame where it hurt the most
                                </Text>
                                <Text style={styles.instructionStep}>
                                    <Text style={styles.stepNumber}>2.</Text> Select your pain intensity (1-10)
                                </Text>
                                <Text style={styles.instructionStep}>
                                    <Text style={styles.stepNumber}>3.</Text> Tap the image on the body part that hurts
                                </Text>
                                <Text style={styles.instructionStep}>
                                    <Text style={styles.stepNumber}>4.</Text> Add notes if needed, then Generate Report
                                </Text>
                            </View>
                            {recordings.length > 1 && (
                                <Text style={styles.multiRecordingHint}>
                                    You have {recordings.length} movements - use Previous/Next to review each one
                                </Text>
                            )}
                        </View>

                        {/* Video Frame Display - portrait aspect ratio */}
                        <View style={[styles.frameContainer, {
                            height: Dimensions.get('window').width * 1.33,  // 4:3 portrait aspect ratio
                            width: '100%',
                        }]}>
                            {currentFrame ? (
                                <>
                                    <TouchableOpacity
                                        activeOpacity={1}
                                        onPress={handleImagePress}
                                        style={{ width: '100%', height: '100%' }}
                                    >
                                        <Image
                                            source={{ uri: currentFrame.uri }}
                                            style={styles.frameImage}
                                            resizeMode="contain"
                                            onLoad={() => console.log('[REVIEW] Image loaded successfully')}
                                            onError={(e) => console.log('[REVIEW] Image load error:', e.nativeEvent.error)}
                                        />
                                    </TouchableOpacity>

                                    {/* Overlay pain points on this frame - tap to remove */}
                                    {painPoints
                                        .filter(p => p.recordingIndex === currentRecordingIndex && p.frameIndex === currentFrameIndex)
                                        .map((point, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[
                                                    styles.painMarker,
                                                    {
                                                        left: point.x - 15,
                                                        top: point.y - 15,
                                                    }
                                                ]}
                                                onPress={() => {
                                                    // Remove this pain point
                                                    setPainPoints(prev => prev.filter(p =>
                                                        !(p.recordingIndex === currentRecordingIndex &&
                                                            p.frameIndex === currentFrameIndex &&
                                                            p.x === point.x && p.y === point.y)
                                                    ));
                                                    // Clear the remembered pain frame for this recording if no more pain points
                                                    const remainingForRecording = painPoints.filter(p =>
                                                        p.recordingIndex === currentRecordingIndex &&
                                                        !(p.frameIndex === currentFrameIndex && p.x === point.x && p.y === point.y)
                                                    );
                                                    if (remainingForRecording.length === 0) {
                                                        setRecordingPainFrames(prev => {
                                                            const updated = { ...prev };
                                                            delete updated[currentRecordingIndex];
                                                            return updated;
                                                        });
                                                    }
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.painMarkerText}>{point.intensity}</Text>
                                                <View style={styles.painMarkerRemoveHint}>
                                                    <Text style={styles.painMarkerRemoveText}>✕</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                </>
                            ) : (
                                <View style={styles.noFrame}>
                                    <Text style={styles.noFrameText}>No frame available</Text>
                                </View>
                            )}
                        </View>

                        {/* Frame Scrubber */}
                        <View style={styles.frameControls}>
                            <Text style={styles.frameCounter}>Frame {currentFrameIndex + 1} / {totalFrames}</Text>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={Math.max(0, totalFrames - 1)}
                                step={1}
                                value={currentFrameIndex}
                                onValueChange={(value) => {
                                    setCurrentFrameIndex(Math.round(value));
                                    loadNotesForFrame(Math.round(value));
                                }}
                                minimumTrackTintColor="#00BCD4"
                                maximumTrackTintColor="rgba(255,255,255,0.2)"
                                thumbTintColor="#00BCD4"
                            />
                        </View>

                        {/* Intensity Selector */}
                        <View style={styles.intensitySection}>
                            <Text style={styles.sectionTitle}>Pain Intensity (tap image to mark)</Text>
                            <View style={styles.intensityButtons}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <TouchableOpacity
                                        key={num}
                                        style={[
                                            styles.intensityBtn,
                                            selectedIntensity === num && styles.intensityBtnSelected
                                        ]}
                                        onPress={() => setSelectedIntensity(num)}
                                    >
                                        <Text style={[
                                            styles.intensityBtnText,
                                            selectedIntensity === num && styles.intensityBtnTextSelected
                                        ]}>
                                            {num}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.painPointCount}>
                                {painPoints.length} pain point{painPoints.length !== 1 ? 's' : ''} marked
                            </Text>

                            {/* Notes Input */}
                            <TextInput
                                style={styles.notesInput}
                                placeholder="Add notes about this pain (optional)"
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={currentNotes}
                                onChangeText={setCurrentNotes}
                                multiline
                                numberOfLines={2}
                            />
                        </View>

                        {/* Recording Navigation */}
                        {recordings.length > 1 && (
                            <View style={styles.recordingNav}>
                                <TouchableOpacity
                                    style={styles.recordingNavBtn}
                                    onPress={goToPrevRecording}
                                    disabled={currentRecordingIndex === 0}
                                >
                                    <Text style={styles.recordingNavText}>← Previous Movement</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.recordingNavBtn}
                                    onPress={goToNextRecording}
                                    disabled={currentRecordingIndex === recordings.length - 1}
                                >
                                    <Text style={styles.recordingNavText}>Next Movement →</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    {/* Loading Overlay */}
                    {isAnalyzing && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#00BCD4" />
                            <Text style={styles.loadingText}>
                                {loadingPhase === 0 && '🔍 Analyzing movement patterns...'}
                                {loadingPhase === 1 && '🧠 AI generating insights...'}
                                {loadingPhase >= 2 && '📝 Preparing your report...'}
                            </Text>
                            <Text style={styles.loadingSubtext}>This may take a moment</Text>
                        </View>
                    )}

                    {/* Success Modal */}
                    <Modal
                        visible={showSuccessModal}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setShowSuccessModal(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.successModal}>
                                <Text style={styles.successEmoji}>🎉</Text>
                                <Text style={styles.successTitle}>Report Saved!</Text>
                                <Text style={styles.successMessage}>
                                    Your movement analysis has been saved. You can view all your reports in your Profile.
                                </Text>
                                <TouchableOpacity
                                    style={styles.successBtnPrimary}
                                    onPress={() => {
                                        setShowSuccessModal(false);
                                        router.replace('/(tabs)/reports');
                                    }}
                                >
                                    <Text style={styles.successBtnPrimaryText}>📊 View Reports</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.successBtnSecondary}
                                    onPress={() => {
                                        setShowSuccessModal(false);
                                        router.replace('/(tabs)/scan');
                                    }}
                                >
                                    <Text style={styles.successBtnSecondaryText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {/* No Pain Points Warning Modal */}
                    <Modal
                        visible={showNoPainPointsModal}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setShowNoPainPointsModal(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.successModal}>
                                <Text style={styles.successEmoji}>⚠️</Text>
                                <Text style={styles.successTitle}>No Pain Points Marked</Text>
                                <Text style={styles.successMessage}>
                                    Please mark at least one pain point on the video frames. Use the slider to find the frame where it hurt the most, then tap the image.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.successBtnPrimary, { backgroundColor: '#00BCD4' }]}
                                    onPress={() => setShowNoPainPointsModal(false)}
                                >
                                    <Text style={styles.successBtnPrimaryText}>Got It</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </SafeAreaView>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A1A2E' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    cancelText: { fontSize: 18, color: '#fff' },
    generateBtn: { backgroundColor: '#00BCD4', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    generateBtnDisabled: { opacity: 0.5 },
    generateBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

    // Instructions header
    instructionsHeader: { paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'rgba(0,188,212,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.3)' },
    instructionsTitle: { fontSize: 20, fontWeight: 'bold', color: '#00BCD4', marginBottom: 12, textAlign: 'center' },
    instructionSteps: { marginBottom: 8 },
    instructionStep: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22, marginBottom: 4 },
    stepNumber: { color: '#00BCD4', fontWeight: 'bold' },
    multiRecordingHint: { fontSize: 12, color: '#FFC107', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
    movementInfo: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 12, textAlign: 'center' },
    movementCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 },
    movementEmoji: { fontSize: 40, marginRight: 12 },
    movementDetails: { flex: 1 },
    movementName: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
    movementMeta: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

    frameContainer: { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    frameImage: { width: '100%', height: '100%' },
    noFrame: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noFrameText: { fontSize: 16, color: 'rgba(255,255,255,0.5)' },

    painMarker: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,87,34,0.8)', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    painMarkerText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
    painMarkerRemoveHint: { position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff' },
    painMarkerRemoveText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },

    frameControls: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2A2A3E' },
    slider: { width: '100%', height: 40, marginTop: 8 },
    navButton: { paddingHorizontal: 16, paddingVertical: 8 },
    navButtonText: { fontSize: 14, color: '#00BCD4', fontWeight: '600' },
    frameCounter: { fontSize: 16, color: '#fff', fontWeight: '600' },

    intensitySection: { paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#2A2A3E', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    sectionTitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 12, textAlign: 'center' },
    intensityButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    intensityBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    intensityBtnSelected: { backgroundColor: '#00BCD4', borderColor: '#fff' },
    intensityBtnText: { fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' },
    intensityBtnTextSelected: { color: '#fff' },
    painPointCount: { fontSize: 12, color: '#00BCD4', textAlign: 'center' },
    notesInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, marginTop: 12, minHeight: 60, textAlignVertical: 'top' },

    // Pain point confirmation banner
    confirmBanner: { backgroundColor: 'rgba(76,175,80,0.2)', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(76,175,80,0.5)' },
    confirmText: { fontSize: 15, color: '#fff', fontWeight: '600', textAlign: 'center', marginBottom: 12 },
    confirmButtons: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
    confirmBtn: { backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
    adjustBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    adjustBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

    recordingNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2A2A3E' },
    recordingNavBtn: { paddingHorizontal: 12, paddingVertical: 8 },
    recordingNavText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },

    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
    loadingText: { fontSize: 18, color: '#fff', marginTop: 16, fontWeight: '600' },
    loadingSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },

    errorText: { fontSize: 18, color: '#fff', textAlign: 'center', marginTop: 100 },
    backButton: { backgroundColor: '#00BCD4', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 25, alignSelf: 'center', marginTop: 20 },
    backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    // Success Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    successModal: { backgroundColor: '#1E1E32', borderRadius: 24, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,188,212,0.3)' },
    successEmoji: { fontSize: 64, marginBottom: 16 },
    successTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
    successMessage: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    successBtnPrimary: { backgroundColor: '#00BCD4', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, marginBottom: 12, width: '100%', alignItems: 'center' },
    successBtnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    successBtnSecondary: { paddingVertical: 12, width: '100%', alignItems: 'center' },
    successBtnSecondaryText: { fontSize: 15, color: 'rgba(255,255,255,0.6)' },
});
