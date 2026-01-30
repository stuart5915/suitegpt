export default {
    expo: {
        name: "Cheshbon Reflections",
        slug: "cheshbon-reflections",
        version: "1.0.0",
        orientation: "portrait",
        updates: {
            url: "https://u.expo.dev/618ff3fb-76ef-4710-bae3-86bd7b280c46"
        },
        runtimeVersion: "1.0.0",
        icon: "./assets/icon.png",
        userInterfaceStyle: "light",
        scheme: "cheshbon",
        newArchEnabled: true,
        splash: {
            image: "./assets/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#F5F2ED"
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.cheshbon.reflections",
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false
            }
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#F5F2ED"
            },
            package: "com.cheshbon.reflections",
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false
        },
        web: {
            favicon: "./assets/favicon.png",
            bundler: "metro",
            output: "static",
            description: "Journal through the Bible at your own pace with AI-powered insights",
            themeColor: "#D4AF37",
            backgroundColor: "#F5F2ED",
            display: "standalone",
            orientation: "portrait",
            startUrl: "/",
            scope: "/"
        },
        plugins: [
            "expo-router",
            "expo-font",
            "expo-dev-client",
            "expo-sqlite",
            "@react-native-community/datetimepicker"
        ],
        experiments: {
            typedRoutes: true,
            baseUrl: "/cheshbon"
        },
        extra: {
            router: {},
            // These values come from EAS environment variables at build time
            supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
            supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
            geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
            googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
            eas: {
                projectId: "618ff3fb-76ef-4710-bae3-86bd7b280c46"
            }
        }
    }
};
