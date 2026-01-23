// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

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

module.exports = config;
