import { useCallback, useRef, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';
import type { Frame } from 'react-native-vision-camera';

import { calculateJointAngle } from './joint-angles';
import type { PoseLandmarks, Landmark, RepPhase } from '@/types';
import { PoseLandmark } from '@/types';

/**
 * Mock pose detection for development
 */
function detectPoseFromFrame(_frame: Frame): PoseLandmarks | null {
    // TODO: Replace with actual MediaPipe integration
    const mockLandmarks: Landmark[] = Array(33).fill(null).map((_, i) => ({
        x: 0.5 + Math.sin(Date.now() / 1000 + i) * 0.1,
        y: 0.3 + (i / 33) * 0.5,
        z: 0,
        visibility: 0.9,
    }));

    return {
        landmarks: mockLandmarks,
        timestamp: Date.now(),
    };
}

interface UsePoseDetectionOptions {
    onPoseDetected?: (pose: PoseLandmarks) => void;
    onRepDetected?: (repCount: number) => void;
    angleThresholdUp?: number;
    angleThresholdDown?: number;
}

interface UsePoseDetectionReturn {
    processFrame: (frame: Frame) => void;
    repCount: number;
    resetRepCount: () => void;
}

export function usePoseDetection({
    onPoseDetected,
    onRepDetected,
    angleThresholdUp = 160,
    angleThresholdDown = 45,
}: UsePoseDetectionOptions = {}): UsePoseDetectionReturn {
    const [repCount, setRepCount] = useState(0);
    const repPhaseRef = useRef<RepPhase>('idle');
    const lastAngleRef = useRef<number>(180);
    const repDebounceRef = useRef<number>(0);

    const DEBOUNCE_MS = 300;

    const handleRepComplete = useCallback(() => {
        const now = Date.now();
        if (now - repDebounceRef.current < DEBOUNCE_MS) {
            return;
        }
        repDebounceRef.current = now;

        setRepCount((prev) => {
            const newCount = prev + 1;
            onRepDetected?.(newCount);
            return newCount;
        });
    }, [onRepDetected]);

    const processFrame = useCallback((frame: Frame) => {
        'worklet';

        const pose = detectPoseFromFrame(frame);
        if (!pose) return;

        if (onPoseDetected) {
            runOnJS(onPoseDetected)(pose);
        }

        const leftElbowAngle = calculateJointAngle(
            pose.landmarks[PoseLandmark.LEFT_SHOULDER],
            pose.landmarks[PoseLandmark.LEFT_ELBOW],
            pose.landmarks[PoseLandmark.LEFT_WRIST]
        );

        const rightElbowAngle = calculateJointAngle(
            pose.landmarks[PoseLandmark.RIGHT_SHOULDER],
            pose.landmarks[PoseLandmark.RIGHT_ELBOW],
            pose.landmarks[PoseLandmark.RIGHT_WRIST]
        );

        const avgAngle = (leftElbowAngle + rightElbowAngle) / 2;
        const phase = repPhaseRef.current;

        if (phase === 'idle' || phase === 'top') {
            if (avgAngle < angleThresholdUp && avgAngle < lastAngleRef.current) {
                repPhaseRef.current = 'eccentric';
            }
        } else if (phase === 'eccentric') {
            if (avgAngle <= angleThresholdDown) {
                repPhaseRef.current = 'bottom';
            }
        } else if (phase === 'bottom') {
            if (avgAngle > angleThresholdDown && avgAngle > lastAngleRef.current) {
                repPhaseRef.current = 'concentric';
            }
        } else if (phase === 'concentric') {
            if (avgAngle >= angleThresholdUp) {
                repPhaseRef.current = 'top';
                runOnJS(handleRepComplete)();
            }
        }

        lastAngleRef.current = avgAngle;
    }, [
        onPoseDetected,
        handleRepComplete,
        angleThresholdUp,
        angleThresholdDown,
    ]);

    const resetRepCount = useCallback(() => {
        setRepCount(0);
        repPhaseRef.current = 'idle';
        lastAngleRef.current = 180;
        repDebounceRef.current = 0;
    }, []);

    return {
        processFrame,
        repCount,
        resetRepCount,
    };
}
