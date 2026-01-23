module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            [
                'babel-preset-expo',
                {
                    // Enable import.meta polyfill for WalletConnect packages
                    unstable_transformImportMeta: true,
                },
            ],
        ],
    };
};
