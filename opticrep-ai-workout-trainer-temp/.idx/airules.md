# OpticRep AI Workout Trainer - Coding Standards

## Project Overview

OpticRep is a React Native (Expo) bodybuilding application with real-time computer vision, AI coaching, and comprehensive workout tracking.

---

## Core Principles

### 1. TypeScript Strictness

```typescript
// ✅ ALWAYS use strict typing
interface RepData {
  id: string;
  setId: string;
  repNumber: number;
  jointAngles: JointAngles;
  tempoSeconds: number;
  formQuality: 'good' | 'fair' | 'poor';
}

// ❌ NEVER use `any`
const badData: any = {}; // FORBIDDEN

// ✅ Use `unknown` when type is uncertain, then narrow
function processData(data: unknown): RepData {
  if (!isRepData(data)) {
    throw new Error('Invalid rep data');
  }
  return data;
}
```

### 2. Functional Components Only

```typescript
// ✅ CORRECT: Functional component with hooks
export function WorkoutCard({ workout }: WorkoutCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <View className="bg-zinc-900 rounded-xl p-4">
      {/* content */}
    </View>
  );
}

// ❌ FORBIDDEN: Class components
class BadWorkoutCard extends React.Component {} // NEVER
```

### 3. Early Returns

```typescript
// ✅ CORRECT: Early returns for guard clauses
function calculateAngle(pose: PoseLandmarks | null): number | null {
  if (!pose) return null;
  if (!pose.leftShoulder || !pose.leftElbow) return null;
  
  const angle = computeAngle(pose.leftShoulder, pose.leftElbow, pose.leftWrist);
  return angle;
}

// ❌ AVOID: Deeply nested conditionals
function badCalculateAngle(pose: PoseLandmarks | null): number | null {
  if (pose) {
    if (pose.leftShoulder && pose.leftElbow) {
      const angle = computeAngle(/* ... */);
      return angle;
    }
  }
  return null;
}
```

---

## File & Folder Conventions

### Directory Structure

```
src/
├── app/                    # Expo Router screens
├── components/             # Reusable UI components
│   ├── ui/                 # Primitive components (Button, Card, etc.)
│   └── features/           # Feature-specific components
├── hooks/                  # Custom React hooks
├── lib/                    # Core utilities and clients
│   ├── supabase/           # Supabase client & queries
│   ├── gemini/             # Gemini API integration
│   └── mediapipe/          # MediaPipe utilities
├── oracle/                 # AI logic module
├── session/                # Active workout session module
├── synthesis/              # Post-workout analysis module
├── types/                  # TypeScript type definitions
└── utils/                  # Generic utility functions
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `WorkoutCard.tsx` |
| Hooks | camelCase with `use` prefix | `useRepCounter.ts` |
| Utilities | camelCase | `formatDuration.ts` |
| Types/Interfaces | PascalCase | `WorkoutPlan.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_REP_TEMPO` |

---

## Component Patterns

### Props Interface Naming

```typescript
// ✅ CORRECT: ComponentName + Props
interface WorkoutCardProps {
  workout: WorkoutPlan;
  onPress?: () => void;
}

export function WorkoutCard({ workout, onPress }: WorkoutCardProps) {
  // ...
}
```

### Prop Destructuring

```typescript
// ✅ CORRECT: Destructure in function signature
export function ExerciseRow({ exercise, isActive, onComplete }: ExerciseRowProps) {
  return (/* ... */);
}

// ❌ AVOID: Props object access
export function BadExerciseRow(props: ExerciseRowProps) {
  return <Text>{props.exercise.name}</Text>; // AVOID
}
```

---

## Styling with NativeWind

### Utility-First Approach

```tsx
// ✅ CORRECT: NativeWind utilities
<View className="flex-1 bg-black">
  <Text className="text-white text-2xl font-bold mb-4">
    Workout Summary
  </Text>
  <View className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
    {/* content */}
  </View>
</View>
```

### Color Palette

```typescript
// Design tokens (use in tailwind.config.js)
const colors = {
  background: '#000000',
  surface: '#18181b',      // zinc-900
  surfaceLight: '#27272a', // zinc-800
  primary: '#22c55e',      // green-500 (tracking status)
  danger: '#ef4444',       // red-500 (occlusion status)
  warning: '#f59e0b',      // amber-500
  text: '#ffffff',
  textMuted: '#a1a1aa',    // zinc-400
};
```

---

## Async Patterns

### Error Handling

```typescript
// ✅ CORRECT: Explicit error handling with types
async function fetchWorkoutPlan(userId: string): Promise<WorkoutPlan | null> {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('[fetchWorkoutPlan]', error.message);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('[fetchWorkoutPlan] Unexpected error:', err);
    return null;
  }
}
```

### Loading States

```typescript
// ✅ Use discriminated unions for async state
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

---

## State Management

### Local State First

```typescript
// ✅ Prefer local state for component-specific data
function RepCounter() {
  const [repCount, setRepCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  // ...
}
```

### Context for Shared State

```typescript
// ✅ Use context for cross-component state
const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
```

---

## Comments & Documentation

### JSDoc for Exports

```typescript
/**
 * Calculates the angle between three body landmarks.
 * @param a - First landmark (e.g., shoulder)
 * @param b - Middle landmark (e.g., elbow) - vertex of the angle
 * @param c - Third landmark (e.g., wrist)
 * @returns Angle in degrees (0-180)
 */
export function calculateJointAngle(
  a: Landmark,
  b: Landmark,
  c: Landmark
): number {
  // ...
}
```

### Inline Comments

```typescript
// ✅ CORRECT: Explain WHY, not WHAT
const DEBOUNCE_MS = 100; // Prevents duplicate rep counting from jittery poses

// ❌ AVOID: Obvious comments
const count = 0; // Initialize count to zero
```

---

## Testing Standards

### Test File Location

```
src/
├── session/
│   ├── pose/
│   │   ├── rep-detector.ts
│   │   └── __tests__/
│   │       └── rep-detector.test.ts
```

### Test Naming

```typescript
describe('RepDetector', () => {
  describe('detectRep', () => {
    it('should return true when angle crosses threshold', () => {
      // ...
    });
    
    it('should not count partial reps', () => {
      // ...
    });
  });
});
```

---

## Import Order

```typescript
// 1. React/React Native
import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';

// 2. External packages
import { Camera } from 'react-native-vision-camera';
import clsx from 'clsx';

// 3. Internal modules (absolute paths)
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';

// 4. Relative imports
import { RepCounter } from './RepCounter';

// 5. Types (always last)
import type { WorkoutPlan } from '@/types';
```

---

## Performance Guidelines

1. **Memoize expensive computations** with `useMemo`
2. **Stabilize callbacks** with `useCallback` when passed as props
3. **Avoid inline object/array creation** in JSX props
4. **Use `FlashList`** instead of `FlatList` for large lists
5. **Debounce rapid pose updates** before state changes

---

## Git Commit Messages

```
feat(session): add rep detection for bicep curls
fix(oracle): correct periodization calculation
refactor(synthesis): extract summary generator
docs(readme): update setup instructions
test(pose): add joint angle calculation tests
```
