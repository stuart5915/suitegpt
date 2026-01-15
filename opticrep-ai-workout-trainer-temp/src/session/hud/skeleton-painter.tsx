import { useMemo } from 'react';
import { Path, Skia, Circle, Group } from '@shopify/react-native-skia';
import { useWindowDimensions } from 'react-native';

import type { Landmark } from '@/types';
import { SKELETON_CONNECTIONS, PoseLandmark } from '@/types';

interface SkeletonPainterProps {
    landmarks: Landmark[];
    color: string;
    strokeWidth?: number;
    jointRadius?: number;
}

/**
 * Draws the 33-point MediaPipe skeleton using Skia for 60fps performance.
 */
export function SkeletonPainter({
    landmarks,
    color,
    strokeWidth = 3,
    jointRadius = 5,
}: SkeletonPainterProps) {
    const { width, height } = useWindowDimensions();

    const screenLandmarks = useMemo(() => {
        return landmarks.map((lm) => ({
            x: lm.x * width,
            y: lm.y * height,
            visibility: lm.visibility,
        }));
    }, [landmarks, width, height]);

    const skeletonPath = useMemo(() => {
        const path = Skia.Path.Make();

        for (const connection of SKELETON_CONNECTIONS) {
            const from = screenLandmarks[connection.from];
            const to = screenLandmarks[connection.to];

            if (from && to && from.visibility > 0.5 && to.visibility > 0.5) {
                path.moveTo(from.x, from.y);
                path.lineTo(to.x, to.y);
            }
        }

        return path;
    }, [screenLandmarks]);

    const keyJointIndices = new Set([
        PoseLandmark.LEFT_SHOULDER,
        PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.LEFT_ELBOW,
        PoseLandmark.RIGHT_ELBOW,
        PoseLandmark.LEFT_WRIST,
        PoseLandmark.RIGHT_WRIST,
        PoseLandmark.LEFT_HIP,
        PoseLandmark.RIGHT_HIP,
        PoseLandmark.LEFT_KNEE,
        PoseLandmark.RIGHT_KNEE,
        PoseLandmark.LEFT_ANKLE,
        PoseLandmark.RIGHT_ANKLE,
    ]);

    return (
        <Group>
            <Path
                path={skeletonPath}
                style="stroke"
                strokeWidth={strokeWidth}
                color={color}
                strokeCap="round"
                strokeJoin="round"
            />

            {screenLandmarks.map((joint, index) => {
                if (joint.visibility <= 0.5) return null;

                const isKeyJoint = keyJointIndices.has(index);
                const radius = isKeyJoint ? jointRadius * 1.5 : jointRadius;

                return (
                    <Circle
                        key={index}
                        cx={joint.x}
                        cy={joint.y}
                        r={radius}
                        color={color}
                    />
                );
            })}
        </Group>
    );
}

/**
 * Generates body region colors for visual distinction
 */
export function getRegionColor(landmarkIndex: number): string {
    if (landmarkIndex >= 11 && landmarkIndex <= 22) {
        return '#22c55e';
    }
    if (landmarkIndex >= 23 && landmarkIndex <= 32) {
        return '#8b5cf6';
    }
    return '#3b82f6';
}
