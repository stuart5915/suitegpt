/**
 * Dream Detail Screen
 * Shows processed dream with title, transcript, scenes, video player, and generation controls
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, Share, Alert, Modal, TextInput, Image, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../components/ui/Typography';
import { BottomNav } from '../../components/ui/BottomNav';
import { Colors, Spacing } from '../../constants/theme';
import {
    getDream,
    subscribeToDream,
    getMoodColor,
    getMoodEmoji,
    updateDreamTranscript,
    type ProcessedDream,
    type DreamScene,
} from '../../services/dreamProcessing';
import {
    triggerReelGeneration,
    getUserCredits,
    getGenerationStatusText,
    subscribeToGenerationStatus,
    type UserCredits,
} from '../../services/videoGeneration';
import { generateDreamImage } from '../../services/imageGeneration';

export default function DreamDetail() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const videoRef = useRef<Video>(null);

    // State
    const [dream, setDream] = useState<ProcessedDream | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [generationStatus, setGenerationStatus] = useState<string | null>(null);
    const [videoMuted, setVideoMuted] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editedTranscript, setEditedTranscript] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Image generation state
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    // Load dream and credits on mount
    useEffect(() => {
        if (id) {
            loadDream();
            loadCredits();
        }
    }, [id]);

    // Subscribe to real-time updates for both dream and generation status
    useEffect(() => {
        if (!id) return;

        const unsubscribeDream = subscribeToDream(id, (updatedDream) => {
            setDream(updatedDream);
            // Check if generation completed
            if (updatedDream.reel_url && isGenerating) {
                setIsGenerating(false);
            }
        });

        const unsubscribeGeneration = subscribeToGenerationStatus(id, (status) => {
            setGenerationStatus(status.generation_status);
            setGenerationProgress(status.generation_progress);
            if (status.generation_status === 'complete' || status.generation_status === 'error') {
                setIsGenerating(false);
                if (status.reel_url) {
                    setDream(prev => prev ? { ...prev, reel_url: status.reel_url } : null);
                }
            }
        });

        return () => {
            unsubscribeDream();
            unsubscribeGeneration();
        };
    }, [id, isGenerating]);

    useFocusEffect(
        useCallback(() => {
            if (id) loadDream();
        }, [id])
    );

    async function loadDream() {
        if (!id) return;
        try {
            const data = await getDream(id);
            setDream(data);
            // Check if actually generating (not just default 'pending')
            // Only show progress for active generation states
            const activeStates = ['generating_1', 'generating_2', 'generating_3', 'stitching', 'uploading'];
            if (data?.generation_status && activeStates.includes(data.generation_status)) {
                setIsGenerating(true);
                setGenerationStatus(data.generation_status);
                setGenerationProgress(data.generation_progress || 0);
            }
        } catch (error) {
            console.error('[DreamDetail] Error loading dream:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    async function loadCredits() {
        const userCredits = await getUserCredits();
        setCredits(userCredits);
    }

    function handleRefresh() {
        setRefreshing(true);
        loadDream();
        loadCredits();
    }

    async function handleGenerateReel() {
        if (!id || isGenerating) return;

        if (!credits || credits.video_credits <= 0) {
            Alert.alert('No Credits', 'You have no video generation credits remaining.');
            return;
        }

        setIsGenerating(true);
        setGenerationStatus('pending');
        setGenerationProgress(0);

        const result = await triggerReelGeneration(id);

        if (!result.success) {
            setIsGenerating(false);
            Alert.alert('Generation Failed', result.error || 'Failed to start video generation.');
        }
    }

    async function handleShare() {
        if (!dream?.reel_url) return;
        try {
            await Share.share({
                url: dream.reel_url,
                message: `Check out my dream: "${dream.title}"`,
            });
        } catch (error) {
            console.error('[DreamDetail] Share error:', error);
        }
    }

    function handleEditTranscript() {
        setEditedTranscript(dream?.transcript || '');
        setShowEditModal(true);
    }

    async function handleSaveTranscript() {
        if (!id || !editedTranscript.trim()) return;

        setIsSaving(true);
        const success = await updateDreamTranscript(id, editedTranscript.trim());
        setIsSaving(false);

        if (success) {
            setDream(prev => prev ? { ...prev, transcript: editedTranscript.trim() } : null);
            setShowEditModal(false);
            Alert.alert('Saved', 'Transcript updated successfully!');
        } else {
            Alert.alert('Error', 'Failed to save transcript. Please try again.');
        }
    }

    async function handleGenerateImage() {
        if (!id || !dream?.transcript || isGeneratingImage) return;

        setIsGeneratingImage(true);

        const result = await generateDreamImage(id, dream.transcript, dream.mood);

        setIsGeneratingImage(false);

        if (result.success && result.imageUrl) {
            setDream(prev => prev ? { ...prev, dream_image_url: result.imageUrl! } : null);
            Alert.alert('Image Generated!', 'Your dream visualization is ready.');
        } else {
            Alert.alert('Image Generation', result.error || 'Failed to generate image.');
        }
    }

    function getStatusText(): string {
        if (generationStatus) {
            return getGenerationStatusText(generationStatus);
        }
        switch (dream?.processing_status) {
            case 'pending': return 'Waiting to process...';
            case 'transcribing': return 'Transcribing your dream...';
            case 'analyzing': return 'Extracting visual scenes...';
            case 'error': return 'Processing failed';
            case 'complete': return '';
            default: return 'Loading...';
        }
    }

    const isProcessing = dream?.processing_status === 'pending' ||
        dream?.processing_status === 'transcribing' ||
        dream?.processing_status === 'analyzing';
    const hasError = dream?.processing_status === 'error';
    const isComplete = dream?.processing_status === 'complete';
    const hasVideo = !!dream?.reel_url;

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={Colors.dreamPurple} />
                <Typography variant="body" color={Colors.mist} style={{ marginTop: Spacing.md }}>
                    Loading dream...
                </Typography>
                <BottomNav />
            </View>
        );
    }

    if (!dream) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Ionicons name="cloud-offline" size={48} color={Colors.fog} />
                <Typography variant="body" color={Colors.mist} style={{ marginTop: Spacing.md }}>
                    Dream not found
                </Typography>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Typography variant="body" color={Colors.dreamPurple}>Go Back</Typography>
                </TouchableOpacity>
                <BottomNav />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
                    <Ionicons name="arrow-back" size={24} color={Colors.starlight} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                {dream.mood && (
                    <View style={[styles.moodBadge, { backgroundColor: getMoodColor(dream.mood) + '30' }]}>
                        <Typography variant="caption" color={getMoodColor(dream.mood)}>
                            {getMoodEmoji(dream.mood)} {dream.mood}
                        </Typography>
                    </View>
                )}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.dreamPurple} />
                }
            >
                {/* Title */}
                <Typography variant="h1" color={Colors.starlight} style={styles.title}>
                    {dream.title || 'Untitled Dream'}
                </Typography>

                {/* Video Player */}
                {hasVideo && (
                    <View style={styles.videoSection}>
                        <Video
                            ref={videoRef}
                            source={{ uri: dream.reel_url! }}
                            style={styles.videoPlayer}
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping
                            shouldPlay
                            isMuted={videoMuted}
                            useNativeControls={false}
                        />
                        <View style={styles.videoControls}>
                            <TouchableOpacity onPress={() => setVideoMuted(!videoMuted)} style={styles.videoButton}>
                                <Ionicons name={videoMuted ? 'volume-mute' : 'volume-high'} size={20} color={Colors.starlight} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleShare} style={styles.videoButton}>
                                <Ionicons name="share-outline" size={20} color={Colors.starlight} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Generation Progress */}
                {isGenerating && (
                    <View style={styles.generationCard}>
                        <View style={styles.generationHeader}>
                            <ActivityIndicator size="small" color={Colors.dreamPurple} />
                            <Typography variant="body" color={Colors.mist} style={{ marginLeft: Spacing.sm, flex: 1 }}>
                                {getStatusText()}
                            </Typography>
                            <Typography variant="caption" color={Colors.fog}>
                                {generationProgress}%
                            </Typography>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${generationProgress}%` }]} />
                        </View>
                    </View>
                )}

                {/* Action Buttons Row */}
                {isComplete && !isGenerating && (
                    <View style={styles.actionRow}>
                        {/* Edit Button */}
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleEditTranscript}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="pencil" size={20} color={Colors.starlight} />
                            <Typography variant="caption" color={Colors.starlight} style={styles.actionLabel}>
                                Edit
                            </Typography>
                        </TouchableOpacity>

                        {/* Generate Image Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, isGeneratingImage && styles.actionButtonDisabled]}
                            onPress={handleGenerateImage}
                            disabled={isGeneratingImage}
                            activeOpacity={0.7}
                        >
                            {isGeneratingImage ? (
                                <ActivityIndicator size="small" color={Colors.starlight} />
                            ) : (
                                <Ionicons name="image" size={20} color={Colors.starlight} />
                            )}
                            <Typography variant="caption" color={Colors.starlight} style={styles.actionLabel}>
                                {isGeneratingImage ? 'Generating...' : 'Image'}
                            </Typography>
                        </TouchableOpacity>

                        {/* Generate Video Button */}
                        {!hasVideo && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.actionButtonPrimary]}
                                onPress={handleGenerateReel}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="film" size={20} color={Colors.starlight} />
                                <Typography variant="caption" color={Colors.starlight} style={styles.actionLabel}>
                                    Video
                                </Typography>
                                {credits && (
                                    <Typography variant="caption" color={Colors.lavender} style={styles.creditsBadge}>
                                        {credits.video_credits}
                                    </Typography>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Dream Image Display */}
                {dream?.dream_image_url && (
                    <View style={styles.dreamImageSection}>
                        <Typography variant="h3" color={Colors.mist} style={styles.sectionTitle}>
                            Dream Visualization
                        </Typography>
                        <Image
                            source={{ uri: dream.dream_image_url }}
                            style={styles.dreamImage}
                            resizeMode="cover"
                        />
                    </View>
                )}

                {/* Processing Status */}
                {isProcessing && (
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="small" color={Colors.dreamPurple} />
                        <Typography variant="body" color={Colors.mist} style={{ marginLeft: Spacing.sm }}>
                            {getStatusText()}
                        </Typography>
                    </View>
                )}

                {/* Error State */}
                {hasError && (
                    <View style={styles.errorCard}>
                        <Ionicons name="warning" size={24} color={Colors.nightmare} />
                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                            <Typography variant="body" color={Colors.nightmare}>Processing Error</Typography>
                            <Typography variant="caption" color={Colors.fog}>
                                {dream.processing_error || 'An error occurred.'}
                            </Typography>
                        </View>
                    </View>
                )}

                {/* Transcript */}
                {dream.transcript && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Typography variant="h3" color={Colors.mist} style={styles.sectionTitle}>
                                Transcript
                            </Typography>
                            <TouchableOpacity onPress={handleEditTranscript} style={styles.editIconButton}>
                                <Ionicons name="pencil-outline" size={16} color={Colors.mist} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.transcriptCard}>
                            <Typography variant="body" color={Colors.starlight} style={styles.transcriptText}>
                                "{dream.transcript}"
                            </Typography>
                        </View>
                    </View>
                )}

                {/* Scenes */}
                {isComplete && dream.scenes && dream.scenes.length > 0 && (
                    <View style={styles.section}>
                        <Typography variant="h3" color={Colors.mist} style={styles.sectionTitle}>
                            Visual Scenes
                        </Typography>
                        {dream.scenes.map((scene: DreamScene) => (
                            <View key={scene.scene_number} style={styles.sceneCard}>
                                <View style={styles.sceneHeader}>
                                    <View style={styles.sceneNumber}>
                                        <Typography variant="caption" color={Colors.starlight}>
                                            {scene.scene_number}
                                        </Typography>
                                    </View>
                                    <Typography variant="caption" color={Colors.fog}>{scene.duration_seconds}s</Typography>
                                </View>
                                <Typography variant="body" color={Colors.starlight} style={styles.sceneDescription}>
                                    {scene.visual_description}
                                </Typography>
                                <View style={styles.sceneDetails}>
                                    <View style={styles.sceneDetail}>
                                        <Ionicons name="videocam" size={14} color={Colors.cosmicCyan} />
                                        <Typography variant="caption" color={Colors.mist} style={{ marginLeft: 4 }}>
                                            {scene.camera_movement}
                                        </Typography>
                                    </View>
                                </View>
                                <View style={styles.keyElements}>
                                    {scene.key_elements?.map((el, i) => (
                                        <View key={i} style={styles.elementTag}>
                                            <Typography variant="caption" color={Colors.lavender}>{el}</Typography>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Edit Transcript Modal */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowEditModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h2" color={Colors.starlight} style={styles.modalTitle}>
                                Edit Transcript
                            </Typography>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.mist} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.transcriptInput}
                            value={editedTranscript}
                            onChangeText={setEditedTranscript}
                            multiline
                            placeholder="Enter your dream transcript..."
                            placeholderTextColor={Colors.fog}
                            autoFocus
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={() => setShowEditModal(false)}
                            >
                                <Typography variant="body" color={Colors.mist}>Cancel</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonPrimary]}
                                onPress={handleSaveTranscript}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color={Colors.starlight} />
                                ) : (
                                    <Typography variant="body" color={Colors.starlight}>Save</Typography>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.midnight },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    backArrow: { padding: Spacing.xs },
    moodBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: 12 },
    scrollView: { flex: 1 },
    content: { paddingHorizontal: Spacing.lg },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: Spacing.md },
    videoSection: { marginBottom: Spacing.lg, borderRadius: 12, overflow: 'hidden' },
    videoPlayer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Colors.void },
    videoControls: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    videoButton: { padding: Spacing.xs, marginLeft: Spacing.sm },
    generationCard: { backgroundColor: Colors.nebula, padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.lg },
    generationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    progressBar: { height: 4, backgroundColor: Colors.cosmic, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: Colors.dreamPurple, borderRadius: 2 },
    generateButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.dreamPurple, padding: Spacing.lg, borderRadius: 12, marginBottom: Spacing.lg,
    },
    // Action buttons row
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.nebula,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: 12,
        minWidth: 80,
    },
    actionButtonPrimary: {
        backgroundColor: Colors.dreamPurple,
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionLabel: {
        marginTop: 4,
        fontWeight: '500',
    },
    creditsBadge: {
        fontSize: 10,
        marginTop: 2,
    },
    // Dream image
    dreamImageSection: {
        marginBottom: Spacing.lg,
    },
    dreamImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: Colors.nebula,
    },
    processingCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.nebula, padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.lg,
    },
    errorCard: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: Colors.nightmare + '20', padding: Spacing.md, borderRadius: 12,
        marginBottom: Spacing.lg, borderLeftWidth: 3, borderLeftColor: Colors.nightmare,
    },
    section: { marginBottom: Spacing.xl },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    sectionTitle: { textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
    editIconButton: {
        padding: Spacing.xs,
    },
    transcriptCard: {
        backgroundColor: Colors.nebula, padding: Spacing.lg, borderRadius: 12,
        borderLeftWidth: 3, borderLeftColor: Colors.dreamPurple,
    },
    transcriptText: { fontStyle: 'italic', lineHeight: 24 },
    sceneCard: { backgroundColor: Colors.nebula, padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.sm },
    sceneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
    sceneNumber: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.dreamPurple,
        alignItems: 'center', justifyContent: 'center',
    },
    sceneDescription: { lineHeight: 22, marginBottom: Spacing.sm },
    sceneDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
    sceneDetail: { flexDirection: 'row', alignItems: 'center' },
    keyElements: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    elementTag: { backgroundColor: Colors.deepViolet + '40', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 4 },
    backButton: { marginTop: Spacing.md, padding: Spacing.md },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.midnight,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: Spacing.lg,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    transcriptInput: {
        backgroundColor: Colors.nebula,
        borderRadius: 12,
        padding: Spacing.md,
        color: Colors.starlight,
        fontSize: 16,
        minHeight: 200,
        textAlignVertical: 'top',
        lineHeight: 24,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.md,
        marginTop: Spacing.lg,
    },
    modalButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: 8,
    },
    modalButtonPrimary: {
        backgroundColor: Colors.dreamPurple,
    },
});
