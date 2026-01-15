import { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';

import type { PoseLandmarks, TrackingStatus } from '@/types';

interface StatusOverlayProps {
    status: TrackingStatus;
    repCount: number;
    setCount: number;
    elapsedSeconds: number;
    pose: PoseLandmarks | null;
    errorMessage?: string;
}

export function StatusOverlay({
    status,
    repCount,
    setCount,
    elapsedSeconds,
    pose,
    errorMessage,
}: StatusOverlayProps) {
    const statusConfig = useMemo(() => {
        switch (status) {
            case 'tracking':
                return { color: '#22c55e', label: '● TRACKING', bgColor: 'rgba(34, 197, 94, 0.2)' };
            case 'partial':
                return { color: '#f59e0b', label: '◐ PARTIAL', bgColor: 'rgba(245, 158, 11, 0.2)' };
            case 'occluded':
                return { color: '#ef4444', label: '○ OCCLUDED', bgColor: 'rgba(239, 68, 68, 0.2)' };
            case 'no_person':
            default:
                return { color: '#71717a', label: '○ NO PERSON', bgColor: 'rgba(113, 113, 122, 0.2)' };
        }
    }, [status]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor, borderColor: statusConfig.color }]}>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                </View>
                <View style={styles.timerBadge}>
                    <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
                </View>
            </View>

            {errorMessage && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            )}

            {status === 'occluded' && (
                <View style={styles.warningContainer}>
                    <Text style={styles.warningText}>📹</Text>
                    <Text style={styles.warningLabel}>Move into camera view</Text>
                </View>
            )}

            <View style={styles.repContainer}>
                <View style={styles.repCard}>
                    <Text style={styles.repLabel}>SET {setCount}</Text>
                    <Text style={styles.repCount}>{repCount}</Text>
                    <Text style={styles.repSubLabel}>REPS</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
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
        fontFamily: 'monospace',
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
    errorContainer: {
        position: 'absolute',
        top: '50%',
        left: 32,
        right: 32,
        alignItems: 'center',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
    },
    warningContainer: {
        position: 'absolute',
        top: '40%',
        left: 32,
        right: 32,
        alignItems: 'center',
    },
    warningText: {
        fontSize: 48,
    },
    warningLabel: {
        color: '#f59e0b',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 12,
        textAlign: 'center',
    },
    repContainer: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    repCard: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        borderRadius: 24,
        paddingHorizontal: 40,
        paddingVertical: 20,
        alignItems: 'center',
    },
    repLabel: {
        color: '#a1a1aa',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 2,
    },
    repCount: {
        color: '#ffffff',
        fontSize: 64,
        fontWeight: '800',
        lineHeight: 72,
    },
    repSubLabel: {
        color: '#71717a',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
    },
});
