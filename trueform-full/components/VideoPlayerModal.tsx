import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Linking,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Try to import WebView - it may not be available in Expo Go
let WebView: any = null;
try {
    WebView = require('react-native-webview').WebView;
} catch (e) {
    // WebView not available
}

interface VideoPlayerModalProps {
    visible: boolean;
    onClose: () => void;
    url: string;
    exerciseName: string;
}

export default function VideoPlayerModal({
    visible,
    onClose,
    url,
    exerciseName
}: VideoPlayerModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [webViewError, setWebViewError] = useState(false);

    // Check if WebView is available
    const isWebViewAvailable = WebView !== null && !webViewError;

    // If WebView isn't available and modal opens, redirect to browser
    useEffect(() => {
        if (visible && !isWebViewAvailable && url) {
            // Open in external browser as fallback
            Linking.openURL(url);
            onClose();
        }
    }, [visible, isWebViewAvailable, url]);

    // If WebView isn't available, don't render the modal
    if (!isWebViewAvailable) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {exerciseName}
                        </Text>
                        <Text style={styles.headerSubtitle}>Video Tutorials</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* WebView */}
                <View style={styles.webviewContainer}>
                    {isLoading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#00BCD4" />
                            <Text style={styles.loadingText}>Finding videos...</Text>
                        </View>
                    )}
                    <WebView
                        source={{ uri: url }}
                        style={styles.webview}
                        onLoadStart={() => setIsLoading(true)}
                        onLoadEnd={() => setIsLoading(false)}
                        onError={() => {
                            setWebViewError(true);
                            Linking.openURL(url);
                            onClose();
                        }}
                        allowsFullscreenVideo={true}
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={false}
                        scalesPageToFit={true}
                    />
                </View>

                {/* Bottom Bar */}
                <View style={styles.bottomBar}>
                    <TouchableOpacity
                        style={styles.openExternalBtn}
                        onPress={() => {
                            Linking.openURL(url);
                            onClose();
                        }}
                    >
                        <Text style={styles.openExternalText}>🔗 Open in Browser</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#0F0F1A',
    },
    headerLeft: {
        flex: 1,
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    webviewContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0F0F1A',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
    },
    bottomBar: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0F0F1A',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    openExternalBtn: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    openExternalText: {
        fontSize: 14,
        color: '#00BCD4',
        fontWeight: '600',
    },
});
