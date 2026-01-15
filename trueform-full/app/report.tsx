import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Easing, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { analyzeMovementHybrid, AIAnalysisResult, AnalysisTier, UserHealthProfile } from '../services/geminiHybridService';
import { supabase, getHealthProfile } from '../services/supabase';

const { width } = Dimensions.get('window');

interface ReportItem {
    movement: string;
    result: AIAnalysisResult;
}

export default function ReportScreen() {
    const [loading, setLoading] = useState(true);
    const [analysisTier, setAnalysisTier] = useState<AnalysisTier>('standard');
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Initializing AI...');
    const [reportData, setReportData] = useState<ReportItem[]>([]);
    const [healthProfile, setHealthProfile] = useState<UserHealthProfile | undefined>(undefined);

    // Animation specific
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        startAnalysis();
        startPulse();
    }, [analysisTier]);

    const startPulse = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true, easing: Easing.ease }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.ease })
            ])
        ).start();
    };

    const startAnalysis = async () => {
        setLoading(true);
        const sessionData = (global as any).reportSessionData;

        if (!sessionData || !Array.isArray(sessionData) || sessionData.length === 0) {
            Alert.alert('Error', 'No session data found');
            router.back();
            return;
        }

        // Fetch user's health profile for personalized analysis
        let userHealthProfile: UserHealthProfile | undefined;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData } = await getHealthProfile(user.id);
                if (profileData) {
                    userHealthProfile = profileData as UserHealthProfile;
                    setHealthProfile(userHealthProfile);
                    console.log('📋 Health profile loaded for AI analysis');
                }
            }
        } catch (err) {
            console.log('Health profile not available for analysis');
        }

        const results: ReportItem[] = [];
        const total = sessionData.length;

        // Sequence of "Magic" status messages
        const statusMessages = [
            "Analyzing spinal alignment...",
            "Detecting biomechanical compensations...",
            "Correlating movement patterns...",
            "Checking for injury risks...",
            "Generating recommendations..."
        ];

        try {
            for (let i = 0; i < total; i++) {
                const recording = sessionData[i];

                // Update status for user feedback
                setProgress((i / total) * 100);
                setStatusText(`Analyzing ${recording.movement.name}...`);

                // Artificial delay for "Flash" model so user sees the cool loading screen (min 2s)
                const startTime = Date.now();

                // Call the Hybrid Service with health profile
                const analysis = await analyzeMovementHybrid({
                    movementName: recording.movement.name,
                    duration: recording.duration,
                    poseData: recording.frames, // This is potentially HUGE. Service filters it.
                    visualFrames: recording.visualFrames || [], // Handles missing frames gracefully
                }, analysisTier, userHealthProfile);

                results.push({
                    movement: recording.movement.name,
                    result: analysis
                });

                // Ensure minimum "Magic" time
                const elapsed = Date.now() - startTime;
                if (elapsed < 2000) await new Promise(r => setTimeout(r, 2000 - elapsed));
            }

            setReportData(results);
            setLoading(false);

        } catch (error) {
            console.error(error);
            Alert.alert('Analysis Failed', 'Something went wrong. Please try again.');
            setLoading(false); // In real app, show error state
        }
    };

    const OverallScore = () => {
        const avgScore = Math.round(reportData.reduce((acc, curr) => acc + curr.result.mobilityScore, 0) / reportData.length);
        const color = avgScore >= 80 ? '#4CAF50' : avgScore >= 60 ? '#FF9800' : '#F44336';

        return (
            <View style={styles.scoreContainer}>
                <View style={[styles.scoreCircle, { borderColor: color }]}>
                    <Text style={[styles.scoreText, { color }]}>{avgScore}</Text>
                    <Text style={styles.scoreLabel}>Mobility Score</Text>
                </View>
                <Text style={styles.tierBadge}>
                    {analysisTier === 'advanced' ? '🚀 PRO ANALYSIS' : '⚡ STANDARD ANALYSIS'}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={['#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
                <Animated.Text style={[styles.loadingIcon, { transform: [{ scale: pulseAnim }] }]}>
                    🧠
                </Animated.Text>
                <Text style={styles.loadingText}>{statusText}</Text>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.loadingSubtext}>
                    Using Gemini {analysisTier === 'advanced' ? '2.5 Pro' : '2.5 Flash'}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={StyleSheet.absoluteFill} />
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.headerTitle}>Diagnostic Report</Text>
                    <Text style={styles.headerDate}>{new Date().toLocaleDateString()}</Text>

                    <OverallScore />

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Physio's Insight</Text>
                    </View>

                    {/* Aggregated Insight - Just usage of first item's summary for now, could be better */}
                    <View style={styles.insightCard}>
                        <Text style={styles.insightText}>
                            {reportData[0]?.result.summary}
                        </Text>
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Detailed Findings</Text>
                    </View>

                    {reportData.map((item, index) => (
                        <View key={index} style={styles.findingCard}>
                            <View style={styles.findingHeader}>
                                <Text style={styles.findingMovement}>{item.movement}</Text>
                                <Text style={[
                                    styles.findingScore,
                                    { color: item.result.mobilityScore > 70 ? '#4CAF50' : '#FF5722' }
                                ]}>
                                    {item.result.mobilityScore}/100
                                </Text>
                            </View>

                            {item.result.keyIssues.map((issue, idx) => (
                                <View key={idx} style={styles.issueRow}>
                                    <Text style={styles.issueIcon}>⚠️</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.issueText}>
                                            <Text style={{ fontWeight: 'bold' }}>{issue.bodyPart}:</Text> {issue.issue}
                                        </Text>
                                    </View>
                                </View>
                            ))}

                            <View style={styles.recommendationBox}>
                                <Text style={styles.recommendationLabel}>💡 Recommendation:</Text>
                                <Text style={styles.recommendationText}>{item.result.recommendation}</Text>
                            </View>

                            {/* Visual Observations (Hybrid Feature) */}
                            {item.result.visualObservations && item.result.visualObservations.length > 0 && (
                                <View style={styles.visualBox}>
                                    <Text style={styles.visualLabel}>👁️ Visual Cues:</Text>
                                    {item.result.visualObservations.map((obs, vIdx) => (
                                        <Text key={vIdx} style={styles.visualText}>• {obs}</Text>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}

                    {/* Pro Upgrade / Re-run */}
                    {analysisTier === 'standard' && (
                        <TouchableOpacity
                            style={styles.upgradeButton}
                            onPress={() => setAnalysisTier('advanced')}
                        >
                            <LinearGradient
                                colors={['#FFD700', '#FFA500']}
                                style={styles.upgradeGradient}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.upgradeText}>✨ Analyze with Advanced AI (Pro)</Text>
                                <Text style={styles.upgradeSubtext}>Get deeper biomechanical insights</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.homeButton}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Text style={styles.homeButtonText}>Back to Home</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
    loadingIcon: { fontSize: 80, marginBottom: 20 },
    loadingText: { color: '#fff', fontSize: 20, marginBottom: 20, fontWeight: '600' },
    loadingSubtext: { color: 'rgba(255,255,255,0.5)', marginTop: 20 },
    progressBar: { width: '70%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#00BCD4' },

    scrollContent: { padding: 20 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    headerDate: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 20 },

    scoreContainer: { alignItems: 'center', marginBottom: 30 },
    scoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    scoreText: { fontSize: 36, fontWeight: 'bold' },
    scoreLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    tierBadge: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', color: '#8be9fd', fontSize: 12 },

    sectionHeader: { marginBottom: 15, marginTop: 10 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', borderLeftWidth: 3, borderLeftColor: '#00BCD4', paddingLeft: 10 },

    insightCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 25 },
    insightText: { color: '#fff', fontSize: 16, lineHeight: 24, fontStyle: 'italic' },

    findingCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 0, marginBottom: 20, overflow: 'hidden' },
    findingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'rgba(255,255,255,0.03)' },
    findingMovement: { color: '#fff', fontSize: 18, fontWeight: '600' },
    findingScore: { fontSize: 18, fontWeight: 'bold' },

    issueRow: { flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 10, paddingTop: 10 },
    issueIcon: { marginRight: 10, fontSize: 16 },
    issueText: { color: '#ddd', fontSize: 14, lineHeight: 20 },

    recommendationBox: { backgroundColor: 'rgba(0,188,212,0.1)', margin: 15, padding: 15, borderRadius: 8 },
    recommendationLabel: { color: '#00BCD4', fontWeight: 'bold', marginBottom: 4, fontSize: 12 },
    recommendationText: { color: '#fff', fontSize: 14 },

    visualBox: { backgroundColor: 'rgba(255,87,34,0.1)', marginHorizontal: 15, marginBottom: 15, padding: 15, borderRadius: 8 },
    visualLabel: { color: '#FF5722', fontWeight: 'bold', marginBottom: 4, fontSize: 12 },
    visualText: { color: '#ffccbc', fontSize: 14, marginBottom: 2 },

    upgradeButton: { marginTop: 10, marginBottom: 15, borderRadius: 12, overflow: 'hidden', elevation: 5 },
    upgradeGradient: { padding: 15, justifyContent: 'center', alignItems: 'center' },
    upgradeText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
    upgradeSubtext: { color: '#333', fontSize: 12 },

    homeButton: { padding: 15, alignItems: 'center' },
    homeButtonText: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
});
