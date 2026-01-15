const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// 1. Get the default Expo config
const config = getDefaultConfig(__dirname);

// 2. Configure it to handle SVGs (for icons)
const { transformer, resolver } = config;
config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"],
};

// 3. Wrap it with NativeWind to handle Tailwind styles
module.exports = withNativeWind(config, { input: "./src/global.css" });