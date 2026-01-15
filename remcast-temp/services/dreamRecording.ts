/**
 * Dream Recording Service
 * Handles audio recording, upload to Supabase Storage, and dream record creation
 */
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Recording configuration for high-quality voice capture
const RECORDING_OPTIONS: Audio.RecordingOptions = {
    isMeteringEnabled: true,
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
    },
    ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
    },
};

// Maximum recording duration (3 minutes in milliseconds)
export const MAX_RECORDING_DURATION_MS = 3 * 60 * 1000;

// Types
export interface RecordingResult {
    uri: string;
    duration: number; // in milliseconds
}

export interface UploadResult {
    publicUrl: string;
    path: string;
}

export interface DraftDream {
    id: string;
    user_id: string;
    audio_url: string;
    created_at: string;
}

/**
 * Request microphone permission
 * @returns true if permission granted, false otherwise
 */
export async function requestMicrophonePermission(): Promise<boolean> {
    try {
        // Web handling
        if (Platform.OS === 'web') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Stop the stream immediately - we just needed to check permission
                stream.getTracks().forEach(track => track.stop());
                return true;
            } catch (err) {
                console.error('[DreamRecording] Web microphone permission denied:', err);
                return false;
            }
        }

        // Native handling
        const { status: existingStatus } = await Audio.getPermissionsAsync();

        if (existingStatus === 'granted') {
            return true;
        }

        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
    } catch (error) {
        console.error('[DreamRecording] Error requesting microphone permission:', error);
        return false;
    }
}

/**
 * Check if microphone permission is already granted
 */
export async function hasMicrophonePermission(): Promise<boolean> {
    try {
        if (Platform.OS === 'web') {
            // Web doesn't have a way to check permission status without prompting
            return true; // We'll handle this when actually recording
        }
        const { status } = await Audio.getPermissionsAsync();
        return status === 'granted';
    } catch (error) {
        console.error('[DreamRecording] Error checking microphone permission:', error);
        return false;
    }
}

/**
 * Create and start a new recording
 * @returns The Recording object
 */
export async function startRecording(): Promise<Audio.Recording> {
    try {
        // Configure audio mode for recording
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
        });

        // Create and prepare the recording
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(RECORDING_OPTIONS);
        await recording.startAsync();

        console.log('[DreamRecording] Recording started');
        return recording;
    } catch (error) {
        console.error('[DreamRecording] Error starting recording:', error);
        throw error;
    }
}

/**
 * Stop an active recording and get the result
 * @param recording The active Recording object
 * @returns Recording result with URI and duration
 */
export async function stopRecording(recording: Audio.Recording): Promise<RecordingResult> {
    try {
        await recording.stopAndUnloadAsync();

        // Reset audio mode
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
        });

        const uri = recording.getURI();
        const status = await recording.getStatusAsync();

        if (!uri) {
            throw new Error('No recording URI available');
        }

        console.log('[DreamRecording] Recording stopped:', {
            uri,
            duration: status.durationMillis,
        });

        return {
            uri,
            duration: status.durationMillis || 0,
        };
    } catch (error) {
        console.error('[DreamRecording] Error stopping recording:', error);
        throw error;
    }
}

/**
 * Upload audio file to Supabase Storage
 * @param uri Local file URI
 * @param userId User's ID for folder organization
 * @param onProgress Optional progress callback (0-100)
 * @returns Upload result with public URL and path
 */
export async function uploadDreamAudio(
    uri: string,
    userId: string,
    onProgress?: (progress: number) => void
): Promise<UploadResult> {
    try {
        const timestamp = Date.now();
        const filename = `${userId}/${timestamp}.m4a`;

        console.log('[DreamRecording] Uploading audio:', { filename, uri });

        let fileData: Uint8Array;

        if (Platform.OS === 'web') {
            // Web: fetch the blob directly
            const response = await fetch(uri);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            fileData = new Uint8Array(arrayBuffer);
        } else {
            // Native: Use expo-file-system to read the file
            // Using legacy API for SDK 54 compatibility
            const FileSystem = require('expo-file-system/legacy');

            // Check if file exists
            const fileInfo = await FileSystem.getInfoAsync(uri);
            console.log('[DreamRecording] File info:', fileInfo);

            if (!fileInfo.exists) {
                throw new Error(`Audio file not found at: ${uri}`);
            }

            // Read the file as base64
            const base64Data = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            console.log('[DreamRecording] Read file, base64 length:', base64Data.length);

            // Convert base64 to Uint8Array
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            fileData = bytes;
        }

        console.log('[DreamRecording] File data size:', fileData.length, 'bytes');

        // Report start of upload
        onProgress?.(10);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('dream-audio')
            .upload(filename, fileData, {
                contentType: 'audio/m4a',
                upsert: false,
            });

        if (error) {
            console.error('[DreamRecording] Upload error:', error);
            throw error;
        }

        onProgress?.(90);

        // Get the public URL
        const { data: urlData } = supabase.storage
            .from('dream-audio')
            .getPublicUrl(filename);

        onProgress?.(100);

        console.log('[DreamRecording] Upload complete:', {
            path: data.path,
            publicUrl: urlData.publicUrl,
        });

        return {
            path: data.path,
            publicUrl: urlData.publicUrl,
        };
    } catch (error) {
        console.error('[DreamRecording] Error uploading audio:', error);
        throw error;
    }
}

/**
 * Create a draft dream record in the database
 * @param userId User's ID
 * @param audioUrl Public URL of the uploaded audio
 * @returns The created dream record
 */
export async function createDraftDream(
    userId: string,
    audioUrl: string
): Promise<DraftDream> {
    try {
        const { data, error } = await supabase
            .from('dreams')
            .insert({
                user_id: userId,
                audio_url: audioUrl,
                // All other fields are NULL - pending AI processing
            })
            .select()
            .single();

        if (error) {
            console.error('[DreamRecording] Error creating dream record:', error);
            throw error;
        }

        console.log('[DreamRecording] Draft dream created:', data);

        return data as DraftDream;
    } catch (error) {
        console.error('[DreamRecording] Error creating draft dream:', error);
        throw error;
    }
}

/**
 * Format milliseconds to MM:SS display
 */
export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Check if we've reached max recording duration
 */
export function hasReachedMaxDuration(durationMs: number): boolean {
    return durationMs >= MAX_RECORDING_DURATION_MS;
}
