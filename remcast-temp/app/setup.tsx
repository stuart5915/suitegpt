/**
 * Dream Capture Screen
 * Record voice dream description with animated UI
 * Live transcription available in development builds
 */
import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import {
    requestMicrophonePermission,
    startRecording,
    stopRecording,
    uploadDreamAudio,
    createDraftDream,
    formatDuration,
    MAX_RECORDING_DURATION_MS,
} from '../services/dreamRecording';
import { triggerDreamProcessing } from '../services/dreamProcessing';

// Minimum duration for AI processing (10 seconds)
const MIN_RECORDING_DURATION_MS = 10 * 1000;

// Optional speech recognition - only works in dev builds, not Expo Go
let SpeechRecognition: any = null;
try {
    SpeechRecognition = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch (e) {
    console.log('[Setup] Speech recognition not available (Expo Go mode)');
}

type CaptureState = 'idle' | 'recording' | 'uploading' | 'processing' | 'success' | 'error';

export default function CaptureScreen() {
    const router = useRouter();
    const { user } = useAuth();

    // State
    const [captureState, setCaptureState] = useState<CaptureState>('idle');
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [createdDreamId, setCreatedDreamId] = useState<string | null>(null);
    const [liveTranscript, setLiveTranscript] = useState<string>('');
    const [speechAvailable, setSpeechAvailable] = useState(false);

    // Check if speech recognition is available on mount
    useEffect(() => {
        if (SpeechRecognition) {
            setSpeechAvailable(true);
            // Set up result listener
            const subscription = SpeechRecognition.addListener?.('result', (event: any) => {
                const results = event?.results;
                if (results && results.length > 0) {
                    const fullTranscript = results
                        .map((r: { transcript: string }) => r.transcript)
                        .join(' ');
                    setLiveTranscript(fullTranscript);
                }
            });
            return () => subscription?.remove?.();
        }
    }, []);

    // Refs
    const recordingRef = useRef<Audio.Recording | null>(null);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;

    // Pulse animation for record button
    useEffect(() => {
        if (captureState === 'idle') {
            // Gentle pulse when idle
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else if (captureState === 'recording') {
            // Intense pulse + glow when recording
            const recordingPulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            const glow = Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.3,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            const wave = Animated.loop(
                Animated.timing(waveAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                })
            );
            recordingPulse.start();
            glow.start();
            wave.start();
            return () => {
                recordingPulse.stop();
                glow.stop();
                wave.stop();
            };
        }
    }, [captureState]);

    // Auto-stop at max duration
    useEffect(() => {
        if (recordingDuration >= MAX_RECORDING_DURATION_MS && captureState === 'recording') {
            handleStopRecording();
        }
    }, [recordingDuration]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => { });
            }
        };
    }, []);

    async function handleStartRecording() {
        try {
            // Check permission
            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) {
                setErrorMessage('Microphone permission is required to record dreams');
                setCaptureState('error');
                return;
            }

            // Clear previous transcript
            setLiveTranscript('');

            // Start recording
            const recording = await startRecording();
            recordingRef.current = recording;
            setCaptureState('recording');
            setRecordingDuration(0);

            // Start duration timer
            const startTime = Date.now();
            durationIntervalRef.current = setInterval(() => {
                setRecordingDuration(Date.now() - startTime);
            }, 100) as unknown as NodeJS.Timeout;

            // Start speech recognition for live transcription (only in dev builds)
            if (SpeechRecognition) {
                try {
                    const speechResult = await SpeechRecognition.requestPermissionsAsync();
                    if (speechResult.granted) {
                        SpeechRecognition.start({
                            lang: 'en-US',
                            interimResults: true,
                            continuous: true,
                        });
                    }
                } catch (speechError) {
                    console.warn('[Capture] Speech recognition not available:', speechError);
                }
            }

        } catch (error) {
            console.error('[Capture] Error starting recording:', error);
            setErrorMessage('Failed to start recording. Please try again.');
            setCaptureState('error');
        }
    }

    async function handleStopRecording() {
        if (!recordingRef.current) return;

        try {
            // Stop speech recognition
            if (SpeechRecognition) {
                try {
                    SpeechRecognition.stop();
                } catch (e) {
                    // Ignore - may not have been started
                }
            }

            // Stop duration timer
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }

            setCaptureState('uploading');
            setUploadProgress(0);

            // Stop recording
            const result = await stopRecording(recordingRef.current);
            recordingRef.current = null;

            if (!user?.id) {
                throw new Error('User not authenticated');
            }

            // Upload to Supabase Storage
            const uploadResult = await uploadDreamAudio(
                result.uri,
                user.id,
                setUploadProgress
            );

            setCaptureState('processing');

            // Create draft dream record
            const dream = await createDraftDream(user.id, uploadResult.publicUrl);
            setCreatedDreamId(dream.id);

            // Wait for AI processing to complete (takes 10-20 seconds)
            const processingResult = await triggerDreamProcessing(dream.id);

            if (!processingResult.success) {
                console.warn('[Capture] Processing failed:', processingResult.error);
                // Still navigate - user can see error on detail page
            }

            setCaptureState('success');

            // Navigate to dream detail screen after brief celebration
            setTimeout(() => {
                router.push({ pathname: '/dream/[id]', params: { id: dream.id } });
            }, 1000);

        } catch (error) {
            console.error('[Capture] Error stopping/uploading recording:', error);
            setErrorMessage('Failed to save your dream. Please try again.');
            setCaptureState('error');
        }
    }

    function handleReset() {
        setCaptureState('idle');
        setRecordingDuration(0);
        setUploadProgress(0);
        setErrorMessage(null);
        setCreatedDreamId(null);
    }

    function getStatusText(): string {
        switch (captureState) {
            case 'idle':
                return 'Tap to record your dream (10+ seconds)';
            case 'recording':
                if (recordingDuration < MIN_RECORDING_DURATION_MS) {
                    const remaining = Math.ceil((MIN_RECORDING_DURATION_MS - recordingDuration) / 1000);
                    return `Keep talking... ${remaining}s more needed`;
                }
                return '✓ Ready! Tap to finish';
            case 'uploading':
                return `Uploading... ${uploadProgress}%`;
            case 'processing':
                return 'Creating your dream...';
            case 'success':
                return 'Dream captured! ✨';
            case 'error':
                return errorMessage || 'Something went wrong';
            default:
                return '';
        }
    }

    function getTimerDisplay(): string {
        return formatDuration(recordingDuration);
    }

    function getMaxTimeDisplay(): string {
        return formatDuration(MAX_RECORDING_DURATION_MS);
    }

    const isRecording = captureState === 'recording';
    const isProcessing = captureState === 'uploading' || captureState === 'processing';
    const canRecord = captureState === 'idle' || captureState === 'error';

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Typography variant="h2" color={Colors.charcoal}>
                    Dream Studio
                </Typography>
                <Typography variant="body" color={Colors.mediumGray} style={{ marginTop: 4 }}>
                    Capture your dream while it's fresh
                </Typography>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Waveform/Visual indicator area */}
                <View style={styles.visualArea}>
                    {isRecording && (
                        <>
                            {/* Animated wave rings */}
                            {[0, 1, 2].map((i) => (
                                <Animated.View
                                    key={i}
                                    style={[
                                        styles.waveRing,
                                        {
                                            opacity: glowAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.1, 0.4 - i * 0.1],
                                            }),
                                            transform: [
                                                {
                                                    scale: pulseAnim.interpolate({
                                                        inputRange: [1, 1.1],
                                                        outputRange: [1.2 + i * 0.3, 1.4 + i * 0.3],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                />
                            ))}
                        </>
                    )}

                    {/* Timer Display */}
                    <View style={styles.timerContainer}>
                        <Typography
                            variant="h1"
                            color={
                                isRecording
                                    ? recordingDuration >= MIN_RECORDING_DURATION_MS
                                        ? '#10B981' // Green when sufficient
                                        : '#EF4444' // Red when too short
                                    : Colors.charcoal
                            }
                            style={styles.timerText}
                        >
                            {getTimerDisplay()}
                        </Typography>
                        {isRecording && (
                            <View style={styles.durationHints}>
                                <Typography
                                    variant="caption"
                                    color={
                                        recordingDuration >= MIN_RECORDING_DURATION_MS
                                            ? '#10B981'
                                            : Colors.mediumGray
                                    }
                                >
                                    {recordingDuration >= MIN_RECORDING_DURATION_MS
                                        ? '✓ Minimum reached'
                                        : `Min: ${formatDuration(MIN_RECORDING_DURATION_MS)}`}
                                </Typography>
                                <Typography variant="caption" color={Colors.mediumGray}>
                                    {' '}• Max: {getMaxTimeDisplay()}
                                </Typography>
                            </View>
                        )}
                    </View>
                </View>

                {/* Live Transcript Display */}
                {(isRecording || liveTranscript) && (
                    <View style={styles.transcriptContainer}>
                        <ScrollView
                            style={styles.transcriptScroll}
                            contentContainerStyle={styles.transcriptContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <Typography
                                variant="body"
                                color={isRecording ? Colors.charcoal : Colors.mediumGray}
                                style={styles.transcriptText}
                            >
                                {liveTranscript || (isRecording ? 'Listening...' : '')}
                            </Typography>
                        </ScrollView>
                        {isRecording && (
                            <View style={styles.listeningIndicator}>
                                <View style={styles.listeningDot} />
                                <Typography variant="caption" color="#EF4444">
                                    Live
                                </Typography>
                            </View>
                        )}
                    </View>
                )}

                {/* Record Button */}
                <Animated.View
                    style={[
                        styles.recordButtonOuter,
                        {
                            transform: [{ scale: pulseAnim }],
                        },
                    ]}
                >
                    {/* Glow effect */}
                    {isRecording && (
                        <Animated.View
                            style={[
                                styles.recordButtonGlow,
                                {
                                    opacity: glowAnim,
                                },
                            ]}
                        />
                    )}

                    <TouchableOpacity
                        style={[
                            styles.recordButton,
                            isRecording && styles.recordButtonActive,
                            isProcessing && styles.recordButtonDisabled,
                        ]}
                        onPress={isRecording ? handleStopRecording : handleStartRecording}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                    >
                        {isProcessing ? (
                            <Ionicons name="hourglass" size={40} color={Colors.white} />
                        ) : isRecording ? (
                            <Ionicons name="stop" size={40} color={Colors.white} />
                        ) : (
                            <Ionicons name="mic" size={40} color={Colors.white} />
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Status Text */}
                <Typography
                    variant="body"
                    color={captureState === 'error' ? '#EF4444' : Colors.charcoal}
                    style={styles.statusText}
                >
                    {getStatusText()}
                </Typography>

                {/* Error Reset Button */}
                {captureState === 'error' && (
                    <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                        <Typography variant="body" color="#6366F1">
                            Try Again
                        </Typography>
                    </TouchableOpacity>
                )}

                {/* Upload Progress Bar */}
                {captureState === 'uploading' && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${uploadProgress}%` },
                                ]}
                            />
                        </View>
                    </View>
                )}
            </View>

            {/* Tips Section */}
            <View style={styles.tipsContainer}>
                <Typography variant="caption" color={Colors.mediumGray} style={styles.tipText}>
                    💡 Record for at least 10 seconds. Describe places, people, feelings, and key moments from your dream.
                </Typography>
            </View>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.cream,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        alignItems: 'center',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    visualArea: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    waveRing: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 2,
        borderColor: '#EF4444',
    },
    timerContainer: {
        alignItems: 'center',
    },
    durationHints: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    timerText: {
        fontSize: 48,
        fontWeight: '300',
        letterSpacing: 2,
    },
    recordButtonOuter: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    recordButtonGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#EF4444',
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#6366F1', // Indigo/dream color
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    recordButtonActive: {
        backgroundColor: '#EF4444', // Red when recording
    },
    recordButtonDisabled: {
        backgroundColor: Colors.mediumGray,
    },
    statusText: {
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    resetButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    progressContainer: {
        width: '80%',
        marginTop: Spacing.md,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#E5E5E5',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#6366F1',
        borderRadius: 2,
    },
    tipsContainer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: 100, // Above bottom nav
    },
    tipText: {
        textAlign: 'center',
        lineHeight: 20,
    },
    transcriptContainer: {
        width: '100%',
        paddingHorizontal: Spacing.lg,
        marginTop: Spacing.md,
        marginBottom: Spacing.md,
        maxHeight: 120,
    },
    transcriptScroll: {
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
        maxHeight: 100,
    },
    transcriptContent: {
        padding: Spacing.md,
        minHeight: 60,
    },
    transcriptText: {
        fontStyle: 'italic',
        lineHeight: 22,
    },
    listeningIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        gap: 6,
    },
    listeningDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
});
