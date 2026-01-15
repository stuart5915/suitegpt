# OpticRep AI Workout Trainer - Project Context

## Overview
React Native (Expo) exercise tracking application with Supabase backend.
Primary focus is on the "Coach" tab (`src/app/(tabs)/coach.tsx`) which serves as the AI Hub.

## Tech Stack
- **Frontend**: React Native, Expo Router, TypeScript
- **Styling**: StyleSheet API (standard React Native styles)
- **Backend**: Supabase (PostgreSQL, Auth)
- **State Management**: React Context + Local Component State

## Current Session Context (Jan 1, 2026)
We are in the middle of a UI/UX Refactor for the "Coach Hub" modals.

### Recent Changes
- **Workouts Modal (`activeModal === 'workouts'`)**:
  - **Status**: COMPLETE (mostly).
  - **Structure**: Converted from a centered floating modal to a **Full-Screen Modal** using `SafeAreaView` and `flex: 1` to resolve scrolling issues on iOS.
  - **Features**:
    - "Overview" section with Volume Trend (graph/stats).
    - "Comparison Grid": Horizontal scrolling list comparing exercise performance across sessions.
    - "All Sessions" list: Vertical list of past workouts.

### Current Objective
**Unify Modal Aesthetics**: The user wants the other modals in `coach.tsx` to match the new "Workouts" modal look and feel.
Currently, these modals use a legacy "centered/floating" style:
- `activeModal === 'diet'`
- `activeModal === 'stats'`
- `showProfileSetup` (Profile/Supplements wizard)

### Style Reference
Use the `App Styles` section in `coach.tsx`.
- **Background**: `#0a0e14` (Deep dark blue/black)
- **Cards**: `#0f1419` or `#1e293b`
- **Text**: White `#ffffff` primary, Slate `#94a3b8` secondary.
- **Accent**: Green `#22c55e` (Trends), Blue `#3b82f6` (Selections).

## Key Files
- `src/app/(tabs)/coach.tsx`: **CRITICAL**. This file currently contains nearly all the logic for the Hub, including all 4 modals. It is large (~2700 lines) and could benefit from component extraction, but for now, we are editing it in place.
- `src/components/`: Shared components (though `coach.tsx` uses mostly inline/local components).

## Commands
- `npm start`: Start Expo development server.
