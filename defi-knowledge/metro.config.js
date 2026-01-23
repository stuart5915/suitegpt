// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// WalletConnect requires Node.js crypto polyfills
config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    crypto: require.resolve('react-native-get-random-values'),
    stream: require.resolve('readable-stream'),
    buffer: require.resolve('buffer'),
};

// Ensure these packages are transpiled properly
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// For web builds, replace @walletconnect/modal-react-native with our mock
// This prevents "React is not defined" errors from the native WalletConnect library
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Replace WalletConnect with mock on web platform
    if (platform === 'web' && moduleName === '@walletconnect/modal-react-native') {
        return {
            filePath: path.resolve(__dirname, 'lib/walletConnectWeb.ts'),
            type: 'sourceFile',
        };
    }
    // Fall back to default resolver
    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
