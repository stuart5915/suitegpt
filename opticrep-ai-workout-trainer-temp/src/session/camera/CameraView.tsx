import { useCallback, useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, Pressable } from 'react-native';
import { RNMediapipe } from '@thinksys/react-native-mediapipe';

import type { TrackingStatus } from '@/types';
import { getDetector } from '../exercise/detectors';

interface CameraViewProps {
    isActive: boolean;
    exerciseName?: string;
    autoStart?: boolean; // Auto-start tracking when camera becomes active
    onRepDetected?: (repNumber: number) => void;
    onSetComplete?: (repCount: number) => void;
    onStatusChange?: (status: TrackingStatus) => void;
}

type ViewState = 'ready' | 'countdown' | 'tracking' | 'adjusting';

export function CameraView({
    isActive,
    exerciseName = 'Bicep Curl',
    autoStart = false,
    onRepDetected,
    onSetComplete,
    onStatusChange,
}: CameraViewProps) {
    const { width, height } = Dimensions.get('window');

    const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('no_person');
    const [viewState, setViewState] = useState<ViewState>('ready');
    const [countdownValue, setCountdownValue] = useState(5);
    const [repCount, setRepCount] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const hasAutoStarted = useRef(false);

    // Rep detection state
    const wasInDownPosition = useRef(false);

    // Get detector for current exercise
    const detector = getDetector(exerciseName);

    // Countdown timer
    useEffect(() => {
        if (viewState !== 'countdown') return;

        if (countdownValue <= 0) {
            setViewState('tracking');
            setRepCount(0);
            setElapsedSeconds(0);
            wasInDownPosition.current = false;
            return;
        }

        const timer = setTimeout(() => {
            setCountdownValue(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [viewState, countdownValue]);

    // Timer for elapsed seconds (only when tracking)
    useEffect(() => {
        if (!isActive || viewState !== 'tracking') {
            return;
        }

        const timer = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [isActive, viewState]);

    // Reset when camera becomes inactive
    useEffect(() => {
        if (!isActive) {
            setElapsedSeconds(0);
            setRepCount(0);
            setCountdownValue(5);
            setViewState('ready');
            wasInDownPosition.current = false;
            hasAutoStarted.current = false;
        }
    }, [isActive]);

    // Auto-start countdown when camera becomes active (after rest ends)
    useEffect(() => {
        if (isActive && autoStart && !hasAutoStarted.current && viewState === 'ready') {
            hasAutoStarted.current = true;
            // Start countdown (same as manual start)
            setCountdownValue(5);
            setViewState('countdown');
        }
    }, [isActive, autoStart, viewState]);

    // Start countdown (for manual start)
    const handleStartSet = useCallback(() => {
        setCountdownValue(5);
        setViewState('countdown');
    }, []);

    // Stop tracking - go to adjustment mode
    const handleStopSet = useCallback(() => {
        setViewState('adjusting');
    }, []);

    // Adjust rep count
    const handleIncrement = useCallback(() => {
        setRepCount(prev => prev + 1);
    }, []);

    const handleDecrement = useCallback(() => {
        setRepCount(prev => Math.max(0, prev - 1));
    }, []);

    // Confirm and complete set
    const handleConfirm = useCallback(() => {
        onSetComplete?.(repCount);
        setViewState('ready');
        setRepCount(0);
        setElapsedSeconds(0);
    }, [repCount, onSetComplete]);

    // Handle landmarks from MediaPipe
    const handleLandmark = useCallback((event: any) => {
        // Handle different data structures from MediaPipe
        const landmarks = event?.nativeEvent?.landmarks
            || event?.landmarks
            || (Array.isArray(event) ? event : null);

        if (!landmarks || landmarks.length === 0) {
            if (trackingStatus !== 'no_person') {
                setTrackingStatus('no_person');
                onStatusChange?.('no_person');
            }
            return;
        }

        // Update tracking status
        if (trackingStatus !== 'tracking') {
            setTrackingStatus('tracking');
            onStatusChange?.('tracking');
        }

        // Only count reps when actively tracking
        if (viewState !== 'tracking') return;

        // Use exercise-specific detector
        try {
            const result = detector.detect(landmarks);
            if (!result) return;

            const { angle, isDown } = result;

            // Debug log every 30 frames
            if (Math.random() < 0.03) {
                if (__DEV__) console.log(`[${detector.name}] angle: ${angle.toFixed(1)}°, isDown: ${isDown}`);
            }

            // Rep detection: down -> up = 1 rep
            if (isDown && !wasInDownPosition.current) {
                wasInDownPosition.current = true;
                if (__DEV__) console.log(`[${detector.name}] DOWN position detected`);
            } else if (!isDown && wasInDownPosition.current && angle > 140) {
                wasInDownPosition.current = false;
                if (__DEV__) console.log(`[${detector.name}] UP position - REP COUNTED!`);
                setRepCount(prev => {
                    const newCount = prev + 1;
                    onRepDetected?.(newCount);
                    return newCount;
                });
            }
        } catch (e) {
            // Silently ignore calculation errors
        }
    }, [trackingStatus, onStatusChange, onRepDetected, viewState, detector]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isActive) {
        return (
            <View style={styles.container}>
                <View style={styles.inactiveContainer}>
                    <Text style={styles.inactiveText}>📷</Text>
                    <Text style={styles.inactiveLabel}>Camera paused</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* MediaPipe Camera with built-in pose detection */}
            <RNMediapipe
                style={[StyleSheet.absoluteFill, { width, height }]}
                width={width}
                height={height}
                face={false}
                leftHand={false}
                rightHand={false}
                pose={true}
                onLandmark={handleLandmark}
            />

            {/* Overlay UI */}
            <View style={styles.overlay} pointerEvents="box-none">
                {/* Status bar */}
                <View style={styles.topBar}>
                    <View style={[
                        styles.statusBadge,
                        {
                            backgroundColor: trackingStatus === 'tracking' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(113, 113, 122, 0.2)',
                            borderColor: trackingStatus === 'tracking' ? '#22c55e' : '#71717a'
                        }
                    ]}>
                        <Text style={[
                            styles.statusText,
                            { color: trackingStatus === 'tracking' ? '#22c55e' : '#71717a' }
                        ]}>
                            {trackingStatus === 'tracking' ? '● TRACKING' : '○ WAITING'}
                        </Text>
                    </View>
                    <View style={styles.timerBadge}>
                        <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
                    </View>
                </View>

                {/* Exercise name indicator */}
                <View style={styles.exerciseBadge}>
                    <Text style={styles.exerciseText}>{exerciseName}</Text>
                </View>

                {/* READY STATE - Start button */}
                {viewState === 'ready' && (
                    <View style={styles.centerContainer}>
                        <Pressable style={styles.startButton} onPress={handleStartSet}>
                            <Text style={styles.startButtonText}>START SET</Text>
                        </Pressable>
                        <Text style={styles.positionHint}>
                            {trackingStatus === 'tracking'
                                ? 'Ready! Tap to begin'
                                : 'Position yourself in frame'}
                        </Text>
                    </View>
                )}

                {/* COUNTDOWN STATE - 5-4-3-2-1-GO */}
                {viewState === 'countdown' && (
                    <View style={styles.countdownContainer}>
                        <Text style={styles.countdownNumber}>
                            {countdownValue > 0 ? countdownValue : 'GO!'}
                        </Text>
                        <Text style={styles.countdownLabel}>Get in position...</Text>
                    </View>
                )}

                {/* TRACKING STATE - Live rep counter */}
                {viewState === 'tracking' && (
                    <View style={styles.repContainer}>
                        <View style={styles.repCard}>
                            <Text style={styles.repCount}>{repCount}</Text>
                            <Text style={styles.repSubLabel}>REPS</Text>
                        </View>
                        <Pressable style={styles.stopButton} onPress={handleStopSet}>
                            <Text style={styles.stopButtonText}>STOP SET</Text>
                        </Pressable>
                    </View>
                )}

                {/* ADJUSTING STATE - Rep adjustment UI */}
                {viewState === 'adjusting' && (
                    <View style={styles.adjustContainer}>
                        <Text style={styles.adjustTitle}>Adjust Reps</Text>
                        <View style={styles.adjustRow}>
                            <Pressable style={styles.adjustButton} onPress={handleDecrement}>
                                <Text style={styles.adjustButtonText}>−</Text>
                            </Pressable>
                            <View style={styles.adjustCountBox}>
                                <Text style={styles.adjustCount}>{repCount}</Text>
                            </View>
                            <Pressable style={styles.adjustButton} onPress={handleIncrement}>
                                <Text style={styles.adjustButtonText}>+</Text>
                            </Pressable>
                        </View>
                        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                            <Text style={styles.confirmButtonText}>CONFIRM</Text>
                        </Pressable>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    inactiveContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inactiveText: {
        fontSize: 64,
        marginBottom: 16,
    },
    inactiveLabel: {
        color: '#71717a',
        fontSize: 16,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    topBar: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    timerBadge: {
        backgroundColor: 'rgba(24, 24, 27, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    timerText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    exerciseBadge: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    exerciseText: {
        color: '#a1a1aa',
        fontSize: 14,
        fontWeight: '500',
        backgroundColor: 'rgba(24, 24, 27, 0.8)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    startButton: {
        backgroundColor: '#22c55e',
        paddingHorizontal: 48,
        paddingVertical: 20,
        borderRadius: 16,
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    startButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: 2,
    },
    positionHint: {
        color: '#a1a1aa',
        fontSize: 14,
        marginTop: 16,
    },
    repContainer: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    repCard: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        borderRadius: 24,
        paddingHorizontal: 48,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    repCount: {
        color: '#ffffff',
        fontSize: 72,
        fontWeight: '800',
        lineHeight: 80,
    },
    repSubLabel: {
        color: '#71717a',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
    },
    stopButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    stopButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    adjustContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
    },
    adjustTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 24,
    },
    adjustRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginBottom: 32,
    },
    adjustButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    adjustButtonText: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: '300',
    },
    adjustCountBox: {
        minWidth: 100,
        alignItems: 'center',
    },
    adjustCount: {
        color: '#ffffff',
        fontSize: 64,
        fontWeight: '800',
    },
    confirmButton: {
        backgroundColor: '#22c55e',
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: 12,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 1,
    },
    countdownContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    countdownNumber: {
        color: '#ffffff',
        fontSize: 120,
        fontWeight: '900',
        textShadowColor: '#22c55e',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    countdownLabel: {
        color: '#a1a1aa',
        fontSize: 18,
        marginTop: 16,
    },
});
