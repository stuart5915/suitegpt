import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, TextInput, ScrollView, Alert, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Movement, getMovementsForPain } from '../../constants/movements';
import { supabase, isHealthProfileComplete } from '../../services/supabase';

type ScanPhase = 'idle' | 'questionnaire' | 'intensity' | 'movements' | 'recording' | 'complete';

interface QuestionnaireData {
    painLocation: string[];
    painDuration: string;
    painTrigger: string[];
    painType: string[];
    priorInjuries: string;
}

interface RecordedFrame {
    uri: string;
    timestamp: number;
}

export default function ScanScreen() {
    const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
    const [questionStep, setQuestionStep] = useState(0);
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<any>(null);

    // Questionnaire
    const [questionnaire, setQuestionnaire] = useState<QuestionnaireData>({
        painLocation: [],
        painDuration: '',
        painTrigger: [],
        painType: [],
        priorInjuries: '',
    });

    // Movements & recording
    const [scanIntensity, setScanIntensity] = useState(1);
    const [movementProtocol, setMovementProtocol] = useState<Movement[]>([]);
    const [currentMovementIndex, setCurrentMovementIndex] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedFrames, setRecordedFrames] = useState<RecordedFrame[]>([]);
    const [recordingTime, setRecordingTime] = useState(0);
    const [allSessionRecordings, setAllSessionRecordings] = useState<any[]>([]);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [showProfilePrompt, setShowProfilePrompt] = useState(false);

    const captureIntervalRef = useRef<any>(null);
    const timerIntervalRef = useRef<any>(null);
    const isRecordingRef = useRef(false);

    // Request permission on mount if not determined yet
    useEffect(() => {
        if (permission === null) {
            // Still loading, wait
            return;
        }
        if (!permission.granted && permission.canAskAgain) {
            // Can request permission
            requestPermission();
        }
    }, [permission]);

    useEffect(() => {
        return () => {
            if (captureIntervalRef.current) clearTimeout(captureIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, []);

    const handleStartAnalysis = async () => {
        // First ensure we have camera permission
        if (!permission?.granted) {
            if (permission?.canAskAgain) {
                const result = await requestPermission();
                if (!result.granted) {
                    Alert.alert(
                        'Camera Permission Required',
                        'TrueForm AI needs camera access to analyze your movements. Please grant camera permission to continue.',
                        [{ text: 'OK' }]
                    );
                    return;
                }
            } else {
                // Permission was denied and can't ask again - need to go to settings
                Alert.alert(
                    'Camera Permission Required',
                    'Camera access was denied. Please enable it in your device Settings to use the movement analysis feature.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Settings', onPress: () => Linking.openSettings() }
                    ]
                );
                return;
            }
        }

        try {
            // Check if health profile is complete
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const isComplete = await isHealthProfileComplete(user.id);
                if (!isComplete) {
                    setShowProfilePrompt(true);
                    return;
                }
            }
        } catch (error) {
            console.error('[Scan] Error checking profile:', error);
            // Continue anyway if profile check fails
        }
        setScanPhase('questionnaire');
    };

    const toggleOption = (field: keyof QuestionnaireData, value: string) => {
        const current = questionnaire[field];
        if (Array.isArray(current)) {
            const newValue = current.includes(value)
                ? current.filter((v) => v !== value)
                : [...current, value];
            setQuestionnaire({ ...questionnaire, [field]: newValue });
        }
    };

    const isSelected = (field: keyof QuestionnaireData, value: string) => {
        const current = questionnaire[field];
        return Array.isArray(current) && current.includes(value);
    };

    const goNext = () => {
        if (questionStep < 4) {
            setQuestionStep(questionStep + 1);
        } else {
            setScanPhase('intensity');
        }
    };

    const goBack = () => {
        if (questionStep > 0) setQuestionStep(questionStep - 1);
    };

    const confirmIntensity = () => {
        const painLocationString = questionnaire.painLocation.join(', ');
        const movements = getMovementsForPain(painLocationString, scanIntensity);
        setMovementProtocol(movements);
        setCurrentMovementIndex(0);
        setScanPhase('movements');
    };

    const startCountdown = () => {
        setCountdown(3);
        const countInterval = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(countInterval);
                    startRecording();
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startRecording = async () => {
        if (!cameraRef.current) {
            Alert.alert('Camera not ready', 'Please wait for camera to initialize');
            setCountdown(null);
            return;
        }

        setIsRecording(true);
        isRecordingRef.current = true;
        setRecordedFrames([]);
        setRecordingTime(0);

        timerIntervalRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);

        setTimeout(async () => {
            if (!cameraRef.current) return;
            try {
                await cameraRef.current.takePictureAsync({ quality: 0.3, base64: false });
            } catch (err) { }

            setTimeout(() => {
                const captureFrame = async () => {
                    try {
                        if (!cameraRef.current || !isRecordingRef.current) return;
                        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: false });
                        if (photo?.uri) {
                            setRecordedFrames(prev => [...prev, { uri: photo.uri, timestamp: Date.now() }]);
                        }
                        captureIntervalRef.current = setTimeout(captureFrame, 67);
                    } catch (err) {
                        captureIntervalRef.current = setTimeout(captureFrame, 67);
                    }
                };
                captureFrame();
            }, 100);
        }, 200);
    };

    const stopRecording = () => {
        setIsRecording(false);
        isRecordingRef.current = false;
        clearTimeout(captureIntervalRef.current);
        clearInterval(timerIntervalRef.current);

        const currentMovement = movementProtocol[currentMovementIndex];
        setAllSessionRecordings(prev => [...prev, {
            movement: currentMovement,
            frames: recordedFrames,
            duration: recordingTime,
        }]);

        if (currentMovementIndex < movementProtocol.length - 1) {
            setCurrentMovementIndex(currentMovementIndex + 1);
            setScanPhase('movements');
        } else {
            setScanPhase('complete');
        }

        setRecordedFrames([]);
        setRecordingTime(0);
    };

    const handleEndSession = () => {
        setScanPhase('idle');
        setQuestionStep(0);
        setQuestionnaire({ painLocation: [], painDuration: '', painTrigger: [], painType: [], priorInjuries: '' });
        setAllSessionRecordings([]);
        setCurrentMovementIndex(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Dynamic guided prompts based on recording time
    const getRecordingPrompt = () => {
        const movementName = movementProtocol[currentMovementIndex]?.name || 'the movement';
        if (recordingTime < 3) {
            return { emoji: '🚶', text: `Begin slowly performing ${movementName}` };
        } else if (recordingTime < 7) {
            return { emoji: '⏸️', text: 'Pause at the point where you feel pain' };
        } else {
            return { emoji: '🛑', text: 'Return and tap Stop when ready' };
        }
    };

    // Show permission denied state
    if (permission && !permission.granted && !permission.canAskAgain) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={{ fontSize: 64, marginBottom: 20 }}>📷</Text>
                    <Text style={styles.title}>Camera Access Required</Text>
                    <Text style={[styles.subtitle, { marginBottom: 20 }]}>
                        TrueForm AI needs camera access to analyze your movements and provide personalized guidance.
                    </Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()}>
                        <Text style={styles.buttonText}>Open Settings</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            {permission?.granted && (
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" mode="picture" />
            )}

            <SafeAreaView style={styles.topBar}>
                <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: isRecording ? '#FF5722' : '#4CAF50' }]} />
                    <Text style={styles.statusText}>{isRecording ? 'Recording' : 'Ready'}</Text>
                </View>
                {isRecording && <Text style={styles.timer}>{formatTime(recordingTime)}</Text>}
            </SafeAreaView>

            {countdown !== null && (
                <View style={styles.countdownOverlay}>
                    <Text style={styles.countdownNumber}>{countdown}</Text>
                    <Text style={styles.countdownText}>Get ready...</Text>
                </View>
            )}

            {scanPhase === 'idle' && (
                <SafeAreaView style={styles.fullOverlay}>
                    <View style={styles.centered}>
                        <Text style={styles.title}>AI Movement Analysis</Text>
                        <Text style={styles.subtitle}>Get personalized physiotherapy guidance</Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={handleStartAnalysis}>
                            <Text style={styles.buttonText}>Start AI Analysis</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            )}

            {scanPhase === 'questionnaire' && (
                <View style={styles.questionnaireOverlay}>
                    <SafeAreaView style={styles.questionnaireContainer}>
                        <Text style={styles.questionProgress}>Question {questionStep + 1} of 5</Text>
                        <ScrollView style={styles.questionContent} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                            {questionStep === 0 && (
                                <>
                                    <Text style={styles.questionText}>Where is your pain located?</Text>
                                    <Text style={styles.questionHint}>Select all that apply</Text>
                                    <View style={styles.optionsGrid}>
                                        {['Neck', 'Shoulder', 'Upper Back', 'Lower Back', 'Hip', 'Knee', 'Other'].map(opt => (
                                            <TouchableOpacity key={opt} style={[styles.optionChip, isSelected('painLocation', opt) && styles.optionChipSelected]} onPress={() => toggleOption('painLocation', opt)}>
                                                <Text style={[styles.optionText, isSelected('painLocation', opt) && styles.optionTextSelected]}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            {questionStep === 1 && (
                                <>
                                    <Text style={styles.questionText}>When did the pain start?</Text>
                                    <View style={styles.optionsGrid}>
                                        {['Today', 'This Week', 'This Month', 'Months Ago', 'Years Ago'].map(opt => (
                                            <TouchableOpacity key={opt} style={[styles.optionChip, questionnaire.painDuration === opt && styles.optionChipSelected]} onPress={() => setQuestionnaire({ ...questionnaire, painDuration: opt })}>
                                                <Text style={[styles.optionText, questionnaire.painDuration === opt && styles.optionTextSelected]}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            {questionStep === 2 && (
                                <>
                                    <Text style={styles.questionText}>What triggers your pain?</Text>
                                    <Text style={styles.questionHint}>Select all that apply</Text>
                                    <View style={styles.optionsGrid}>
                                        {['Movement', 'Rest/Sitting', 'Morning Stiffness', 'Exercise', 'Work Activities'].map(opt => (
                                            <TouchableOpacity key={opt} style={[styles.optionChip, isSelected('painTrigger', opt) && styles.optionChipSelected]} onPress={() => toggleOption('painTrigger', opt)}>
                                                <Text style={[styles.optionText, isSelected('painTrigger', opt) && styles.optionTextSelected]}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            {questionStep === 3 && (
                                <>
                                    <Text style={styles.questionText}>What type of pain do you feel?</Text>
                                    <Text style={styles.questionHint}>Select all that apply</Text>
                                    <View style={styles.optionsGrid}>
                                        {['Sharp', 'Dull/Aching', 'Burning', 'Stiffness', 'Tingling', 'Throbbing'].map(opt => (
                                            <TouchableOpacity key={opt} style={[styles.optionChip, isSelected('painType', opt) && styles.optionChipSelected]} onPress={() => toggleOption('painType', opt)}>
                                                <Text style={[styles.optionText, isSelected('painType', opt) && styles.optionTextSelected]}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            {questionStep === 4 && (
                                <>
                                    <Text style={styles.questionText}>Any prior injuries?</Text>
                                    <TextInput style={styles.textInput} placeholder="e.g., Surgery, sports injury, arthritis..." placeholderTextColor="rgba(255,255,255,0.4)" multiline value={questionnaire.priorInjuries} onChangeText={(text) => setQuestionnaire({ ...questionnaire, priorInjuries: text })} />
                                </>
                            )}
                        </ScrollView>
                        <View style={styles.navButtons}>
                            {questionStep > 0 ? (
                                <TouchableOpacity style={styles.secondaryButton} onPress={goBack}><Text style={styles.secondaryButtonText}>← Back</Text></TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.secondaryButton} onPress={handleEndSession}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.primaryButton} onPress={goNext}><Text style={styles.buttonText}>Next →</Text></TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            )}

            {scanPhase === 'intensity' && (
                <View style={styles.intensityOverlay}>
                    <SafeAreaView style={styles.intensityContainer}>
                        <Text style={styles.intensityTitle}>📊 Scan Depth</Text>
                        <Text style={styles.subtitle}>How thorough should the analysis be?</Text>
                        <View style={styles.intensityRow}>
                            {[1, 2, 3, 4, 5].map(level => (
                                <TouchableOpacity key={level} style={[styles.intensityBtn, scanIntensity === level && styles.intensityBtnSelected]} onPress={() => setScanIntensity(level)}>
                                    <Text style={[styles.intensityBtnText, scanIntensity === level && styles.intensityBtnTextSelected]}>{level}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.intensityLabels}>
                            <Text style={styles.intensityLabel}>Quick</Text>
                            <Text style={styles.intensityLabel}>Thorough</Text>
                        </View>
                        <TouchableOpacity style={styles.primaryButton} onPress={confirmIntensity}><Text style={styles.buttonText}>Begin Assessment</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => setScanPhase('questionnaire')}><Text style={styles.secondaryButtonText}>← Back</Text></TouchableOpacity>
                    </SafeAreaView>
                </View>
            )}

            {scanPhase === 'movements' && !isRecording && (
                <View style={styles.movementFullScreen}>
                    <SafeAreaView style={styles.movementFullContent}>
                        <View style={styles.movementHeader}>
                            <Text style={styles.movementProgress}>Movement {currentMovementIndex + 1} of {movementProtocol.length}</Text>
                            <Text style={styles.movementEmoji}>{movementProtocol[currentMovementIndex]?.emoji}</Text>
                            <Text style={styles.movementName}>{movementProtocol[currentMovementIndex]?.name}</Text>
                            <Text style={styles.movementInstructionSmall}>{movementProtocol[currentMovementIndex]?.instruction}</Text>
                        </View>

                        <View style={styles.quickInstructions}>
                            <Text style={styles.quickStep}>📱 Place phone 5-7 ft away</Text>
                            <Text style={styles.quickStep}>⏱️ 3 sec countdown to get in position</Text>
                            <Text style={styles.quickStep}>🦵 Move slowly until pain, hold 1-2 sec</Text>
                            <Text style={styles.quickStep}>🛑 Walk back and tap Stop</Text>
                        </View>

                        <View style={styles.movementButtons}>
                            <TouchableOpacity style={styles.startRecordingButton} onPress={startCountdown}>
                                <Text style={styles.startRecordingText}>▶ Start Recording</Text>
                            </TouchableOpacity>
                            {currentMovementIndex > 0 && (
                                <TouchableOpacity style={styles.redoButton} onPress={() => { setAllSessionRecordings(prev => prev.slice(0, -1)); setCurrentMovementIndex(currentMovementIndex - 1); }}>
                                    <Text style={styles.redoButtonText}>↺ Redo Previous</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            )}

            {isRecording && (
                <SafeAreaView style={styles.recordingOverlay}>
                    {/* Big Guided Prompt */}
                    <View style={styles.guidedPromptBox}>
                        <Text style={styles.guidedEmoji}>{getRecordingPrompt().emoji}</Text>
                        <Text style={styles.guidedText}>{getRecordingPrompt().text}</Text>
                    </View>

                    <View style={styles.recordingInfo}>
                        <Text style={styles.recordingSubtext}>{recordedFrames.length} frames captured</Text>
                    </View>

                    <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                        <View style={styles.stopIcon} />
                        <Text style={styles.buttonText}>Stop</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            )}

            {scanPhase === 'complete' && (
                <View style={styles.completeOverlay}>
                    <SafeAreaView style={styles.completeContainer}>
                        {/* Celebration emojis */}
                        <View style={styles.celebrationRow}>
                            <Text style={styles.confettiEmoji}>🎉</Text>
                            <Text style={styles.confettiEmoji}>🎊</Text>
                            <Text style={styles.confettiEmoji}>🎉</Text>
                        </View>
                        <Text style={styles.celebrationEmoji}>🏆</Text>
                        <Text style={styles.completeTitle}>Assessment Complete!</Text>
                        <Text style={styles.completeSubtitle}>{allSessionRecordings.length} movements recorded</Text>
                        <View style={styles.celebrationRow}>
                            <Text style={styles.sparkleEmoji}>✨</Text>
                            <Text style={styles.sparkleEmoji}>⭐</Text>
                            <Text style={styles.sparkleEmoji}>✨</Text>
                        </View>
                        <TouchableOpacity style={styles.primaryButton} onPress={() => {
                            router.push({
                                pathname: '/review',
                                params: { sessionData: encodeURIComponent(JSON.stringify({ recordings: allSessionRecordings, questionnaire, scanIntensity })) },
                            });
                        }}>
                            <Text style={styles.buttonText}>Review & Generate Report</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.redoButton} onPress={() => { setAllSessionRecordings(prev => prev.slice(0, -1)); setCurrentMovementIndex(movementProtocol.length - 1); setScanPhase('movements'); }}>
                            <Text style={styles.redoButtonText}>↺ Redo Last Recording</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryButton} onPress={handleEndSession}><Text style={styles.secondaryButtonText}>Start New Session</Text></TouchableOpacity>
                    </SafeAreaView>
                </View>
            )}

            {/* Profile Completion Prompt Modal */}
            <Modal
                visible={showProfilePrompt}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProfilePrompt(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.profilePromptCard}>
                        <Text style={styles.profilePromptIcon}>📋</Text>
                        <Text style={styles.profilePromptTitle}>Complete Your Profile</Text>
                        <Text style={styles.profilePromptDesc}>
                            For more accurate exercise recommendations, please fill out your health profile first.
                        </Text>
                        <TouchableOpacity
                            style={styles.profilePromptPrimaryBtn}
                            onPress={() => {
                                setShowProfilePrompt(false);
                                router.push('/(tabs)/profile');
                            }}
                        >
                            <Text style={styles.profilePromptPrimaryText}>Go to Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.profilePromptSecondaryBtn}
                            onPress={() => {
                                setShowProfilePrompt(false);
                                setScanPhase('questionnaire');
                            }}
                        >
                            <Text style={styles.profilePromptSecondaryText}>Continue Anyway</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, zIndex: 5 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { color: '#fff', fontSize: 12 },
    timer: { fontSize: 20, fontWeight: '700', color: '#FF5722', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    countdownNumber: { fontSize: 120, fontWeight: 'bold', color: '#00BCD4' },
    countdownText: { fontSize: 18, color: '#fff', marginTop: 20 },
    fullOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 40, textAlign: 'center' },
    primaryButton: { backgroundColor: '#00BCD4', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, marginTop: 20 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    secondaryButton: { paddingVertical: 16, paddingHorizontal: 24, marginTop: 10 },
    secondaryButtonText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center' },
    questionnaireOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,46,0.98)', zIndex: 999 },
    questionnaireContainer: { flex: 1, padding: 24, justifyContent: 'space-between' },
    questionProgress: { color: '#00BCD4', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 20 },
    questionContent: { flex: 1, marginVertical: 20 },
    questionText: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
    questionHint: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 20 },
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    optionChip: { backgroundColor: 'rgba(0,188,212,0.2)', borderWidth: 2, borderColor: '#00BCD4', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 14, marginRight: 8, marginBottom: 12 },
    optionChipSelected: { backgroundColor: '#00BCD4', borderColor: '#fff' },
    optionText: { color: '#fff', fontSize: 16, fontWeight: '500' },
    optionTextSelected: { fontWeight: 'bold' },
    textInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
    navButtons: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20 },
    intensityOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 999 },
    intensityContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    intensityTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
    intensityRow: { flexDirection: 'row', gap: 12, marginVertical: 20 },
    intensityBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
    intensityBtnSelected: { backgroundColor: '#00BCD4', borderColor: '#fff' },
    intensityBtnText: { fontSize: 20, fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' },
    intensityBtnTextSelected: { color: '#fff' },
    intensityLabels: { flexDirection: 'row', justifyContent: 'space-between', width: 280, marginBottom: 20 },
    intensityLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

    // Full screen movement ready
    movementFullScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 999 },
    movementFullContent: { flex: 1, justifyContent: 'space-between', padding: 20 },
    movementHeader: { alignItems: 'center', paddingTop: 20 },
    movementProgress: { color: '#00BCD4', fontSize: 14, fontWeight: '600', marginBottom: 12 },
    movementEmoji: { fontSize: 48, marginBottom: 8 },
    movementName: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    movementInstructionSmall: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', lineHeight: 20 },

    quickInstructions: { backgroundColor: 'rgba(0,188,212,0.15)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(0,188,212,0.3)' },
    quickStep: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginVertical: 6 },

    movementButtons: { alignItems: 'center', paddingBottom: 20 },
    startRecordingButton: { backgroundColor: '#00BCD4', paddingVertical: 18, paddingHorizontal: 50, borderRadius: 30 },
    startRecordingText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    redoButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 20 },
    redoButtonText: { color: '#FFC107', fontSize: 15, fontWeight: '600', textAlign: 'center' },

    recordingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100, zIndex: 999 },
    recordingInfo: { alignItems: 'center', marginBottom: 40 },
    recordingText: { fontSize: 20, color: '#fff', fontWeight: '600', marginBottom: 8 },
    framesText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
    stopButton: { backgroundColor: '#F44336', paddingVertical: 20, paddingHorizontal: 50, borderRadius: 40, flexDirection: 'row', alignItems: 'center', gap: 12 },
    stopIcon: { width: 20, height: 20, backgroundColor: '#fff', borderRadius: 4 },

    // Guided prompts during recording
    guidedPromptBox: { backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 20, padding: 24, marginBottom: 30, alignItems: 'center', marginHorizontal: 20 },
    guidedEmoji: { fontSize: 56, marginBottom: 12 },
    guidedText: { fontSize: 22, color: '#fff', fontWeight: '600', textAlign: 'center', lineHeight: 30 },
    recordingSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },

    completeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 999 },
    completeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    completeTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 10, textAlign: 'center' },
    completeSubtitle: { fontSize: 18, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 12 },
    celebrationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginVertical: 8 },
    confettiEmoji: { fontSize: 36 },
    celebrationEmoji: { fontSize: 80, marginVertical: 16 },
    sparkleEmoji: { fontSize: 28 },

    // Profile Prompt Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    profilePromptCard: { backgroundColor: '#1A1A2E', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
    profilePromptIcon: { fontSize: 48, marginBottom: 12 },
    profilePromptTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
    profilePromptDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
    profilePromptPrimaryBtn: { backgroundColor: '#00BCD4', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 12 },
    profilePromptPrimaryText: { fontSize: 16, fontWeight: '700', color: '#0D0D1A' },
    profilePromptSecondaryBtn: { paddingVertical: 12 },
    profilePromptSecondaryText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
});
