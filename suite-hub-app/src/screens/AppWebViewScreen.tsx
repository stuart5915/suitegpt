import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { App } from '../services/supabase';

export default function AppWebViewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { app } = route.params as { app: App };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const appUrl = app.app_url?.startsWith('http')
    ? app.app_url
    : `https://www.getsuite.app${app.app_url}`;

  function goBack() {
    navigation.goBack();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* WebView - Fullscreen */}
      <WebView
        source={{ uri: appUrl }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setError(true)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
      />

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primaryOrange} />
          <Text style={styles.loadingText}>Loading {app.name}...</Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Failed to load app</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setError(false)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating SUITE Button - Returns to Hub */}
      <TouchableOpacity
        onPress={goBack}
        style={[styles.floatingButton, { bottom: insets.bottom + 100 }]}
      >
        <Text style={styles.floatingButtonIcon}>◀</Text>
        <Text style={styles.floatingButtonText}>SUITE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primaryOrange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    left: 20,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryOrange,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingButtonIcon: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginRight: 6,
  },
  floatingButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
});
