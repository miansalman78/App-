const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    unstable_allowRequireContext: true,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  };

  // Create default resolver
  const defaultResolver = require('metro-resolver');

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
    // Resolve AWS SDK dynamic import issues
    resolveRequest: (context, moduleName, platform) => {
      // Handle async-require.js path that AWS SDK tries to import
      if (
        moduleName.includes('async-require.js') || 
        moduleName.includes('@expo/metro-config/build/async-require')
      ) {
        // Return mock module for async-require
        return {
          filePath: path.resolve(__dirname, 'utils/async-require-mock.js'),
          type: 'sourceFile',
        };
      }
      // Use default resolver for everything else
      return defaultResolver.resolve(context, moduleName, platform);
    },
  };

  return config;
})();