# OpticRep AI Workout Trainer

A high-performance, data-driven bodybuilding app combining real-time computer vision, AI coaching, and comprehensive workout tracking.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (Camera requires physical device for full functionality)
- Supabase Account
- Google AI Studio API Key (Gemini)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Add your API keys to .env
# EXPO_PUBLIC_SUPABASE_URL=...
# EXPO_PUBLIC_SUPABASE_ANON_KEY=...
# EXPO_PUBLIC_GEMINI_API_KEY=...

# Start development server
npm start
```

### Building Development Client

This app uses native modules and **cannot run in Expo Go**. Build a development client:

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

## 📱 Features

- **AI-Tracked Workouts**: MediaPipe pose detection auto-counts reps
- **60fps HUD**: Skia-powered skeletal overlay
- **Pro-Coach Chat**: RAG-powered AI coaching with memory
- **Voice Reflections**: Record audio, analyzed by Gemini
- **Flexible Scheduling**: 1-7 day workout plans
- **Recovery Tracking**: Sleep, stress, energy logging

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native + Expo |
| Routing | Expo Router |
| Styling | NativeWind (Tailwind) |
| Backend | Supabase (Auth, PostgreSQL, Vector) |
| AI | Gemini 1.5 Pro |
| Vision | react-native-mediapipe |
| Camera | react-native-vision-camera |
| HUD | @shopify/react-native-skia |

## 📁 Project Structure

```
src/
├── app/                    # Expo Router screens
├── lib/
│   ├── supabase/           # Database client & types
│   └── gemini/             # AI client
├── oracle/                 # AI scheduling & chat
├── session/                # Camera, pose, HUD
├── synthesis/              # Post-workout analysis
└── types/                  # TypeScript definitions
```

## 📖 Documentation

- [Architecture](./architecture.md) - System design & data flow
- [Coding Standards](./.idx/airules.md) - TypeScript conventions

## 🗄 Database Setup

Run the migrations in your Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

## 📝 License

MIT
