const { getDefaultConfig } = require('expo/metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  };

  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
    alias: {
      crypto: 'react-native-crypto-js',
      stream: 'readable-stream',
      buffer: 'buffer',
    },
    unstable_enablePackageExports: true,
  };
  
  // Add transformer config for better dynamic import handling
  config.transformer = {
    ...config.transformer,
    unstable_allowRequireContext: true,
  };

  return config;
})();