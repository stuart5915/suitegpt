import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';

import type { TrackingStatus } from '@/types';

/**
 * Audio feedback system for workout sessions.
 */
export function useAudioCues() {
    const [isEnabled, setIsEnabled] = useState(true);
    const lastOcclusionTimeRef = useRef<number>(0);

    const OCCLUSION_COOLDOWN_MS = 5000;

    /**
     * Play rep completion beep
     */
    const playRepComplete = useCallback(async () => {
        if (!isEnabled) return;
        if (__DEV__) console.log('[AudioCues] 🔔 Rep complete');
    }, [isEnabled]);

    /**
     * Play set completion sound
     */
    const playSetComplete = useCallback(async () => {
        if (!isEnabled) return;
        if (__DEV__) console.log('[AudioCues] 🎉 Set complete');
    }, [isEnabled]);

    /**
     * Play occlusion warning
     */
    const playOcclusionWarning = useCallback(async () => {
        if (!isEnabled) return;

        const now = Date.now();
        if (now - lastOcclusionTimeRef.current < OCCLUSION_COOLDOWN_MS) {
            return;
        }
        lastOcclusionTimeRef.current = now;

        if (__DEV__) console.log('[AudioCues] ⚠️ Occlusion warning');
    }, [isEnabled]);

    /**
     * Play tracking restored notification
     */
    const playTrackingRestored = useCallback(async () => {
        if (!isEnabled) return;
        if (__DEV__) console.log('[AudioCues] ✅ Tracking restored');
    }, [isEnabled]);

    /**
     * Handle tracking status change
     */
    const handleStatusChange = useCallback((
        newStatus: TrackingStatus,
        previousStatus: TrackingStatus
    ) => {
        if (newStatus === 'occluded' && previousStatus !== 'occluded') {
            playOcclusionWarning();
        } else if (
            newStatus === 'tracking' &&
            (previousStatus === 'occluded' || previousStatus === 'no_person')
        ) {
            playTrackingRestored();
        }
    }, [playOcclusionWarning, playTrackingRestored]);

    return {
        isEnabled,
        setIsEnabled,
        playRepComplete,
        playSetComplete,
        playOcclusionWarning,
        playTrackingRestored,
        handleStatusChange,
    };
}

/**
 * Hook for recording voice reflections.
 */
export function useVoiceRecorder() {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [durationSeconds, setDurationSeconds] = useState(0);

    const startRecording = useCallback(async () => {
        try {
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                console.error('[VoiceRecorder] Microphone permission denied');
                return false;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);
            setRecordingUri(null);

            const startTime = Date.now();
            const durationInterval = setInterval(() => {
                setDurationSeconds(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);

            newRecording.setOnRecordingStatusUpdate((status) => {
                if (!status.isRecording) {
                    clearInterval(durationInterval);
                }
            });

            if (__DEV__) console.log('[VoiceRecorder] 🎙️ Recording started');
            return true;
        } catch (error) {
            console.error('[VoiceRecorder] Failed to start recording:', error);
            return false;
        }
    }, []);

    const stopRecording = useCallback(async (): Promise<string | null> => {
        if (!recording) return null;

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            setRecording(null);
            setIsRecording(false);
            setRecordingUri(uri);

            if (__DEV__) console.log('[VoiceRecorder] 🎙️ Recording saved to:', uri);
            return uri;
        } catch (error) {
            console.error('[VoiceRecorder] Failed to stop recording:', error);
            return null;
        }
    }, [recording]);

    const cancelRecording = useCallback(async () => {
        if (!recording) return;

        try {
            await recording.stopAndUnloadAsync();
            setRecording(null);
            setIsRecording(false);
            setDurationSeconds(0);
        } catch (error) {
            console.error('[VoiceRecorder] Failed to cancel recording:', error);
        }
    }, [recording]);

    return {
        isRecording,
        recordingUri,
        durationSeconds,
        startRecording,
        stopRecording,
        cancelRecording,
    };
}
