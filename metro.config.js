const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration for Expo
 * https://docs.expo.dev/guides/customizing-metro
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// Configure SVG transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

const projectRoot = __dirname;

// Ensure node_modules is watched
config.watchFolders = [
  ...(config.watchFolders || []),
  path.join(projectRoot, 'node_modules'),
];

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  resolveRequest(context, moduleName, platform) {
    if (platform === 'web' && moduleName === 'react-native-maps') {
      return { type: 'sourceFile', filePath: path.resolve(projectRoot, 'src/stubs/react-native-maps.web.js') };
    }
    if (platform === 'web' && moduleName === 'react-native-maps-directions') {
      return { type: 'sourceFile', filePath: path.resolve(projectRoot, 'src/stubs/react-native-maps-directions.web.js') };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
