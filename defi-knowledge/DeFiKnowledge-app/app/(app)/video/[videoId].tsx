import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    StatusBar,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Typography } from '@/constants/Colors';

export default function VideoPlayerScreen() {
    const { videoId, title, creator } = useLocalSearchParams<{
        videoId: string;
        title: string;
        creator: string;
    }>();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    // Use mobile YouTube URL directly (not embed) - works better on iOS
    const youtubeUrl = `https://m.youtube.com/watch?v=${videoId}`;

    const openInYouTube = () => {
        Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
    };

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: false,
                }}
            />
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {title || 'Video'}
                        </Text>
                        {creator && (
                            <Text style={styles.headerCreator}>@{creator}</Text>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.youtubeButton}
                        onPress={openInYouTube}
                    >
                        <Ionicons name="open-outline" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Full Screen WebView with YouTube Mobile */}
                <View style={styles.webviewContainer}>
                    {isLoading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={styles.loadingText}>Loading video...</Text>
                        </View>
                    )}
                    <WebView
                        source={{ uri: youtubeUrl }}
                        style={styles.webview}
                        allowsFullscreenVideo
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled
                        domStorageEnabled
                        onLoadStart={() => setIsLoading(true)}
                        onLoadEnd={() => setIsLoading(false)}
                        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
                    />
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    closeButton: {
        padding: Spacing.sm,
    },
    headerInfo: {
        flex: 1,
        marginHorizontal: Spacing.sm,
    },
    headerTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    headerCreator: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    youtubeButton: {
        padding: Spacing.sm,
    },
    webviewContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    webview: {
        flex: 1,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    loadingText: {
        color: Colors.textMuted,
        fontSize: Typography.fontSize.sm,
        marginTop: Spacing.md,
    },
});
