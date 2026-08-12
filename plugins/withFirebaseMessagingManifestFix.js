const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Resolve manifest merger conflict between expo-notifications and
 * @react-native-firebase/messaging for default_notification_color.
 * RNFB ships @color/white; app wants @color/notification_icon_color.
 */
const META_NAME = 'com.google.firebase.messaging.default_notification_color';

module.exports = function withFirebaseMessagingManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.$) {
      manifest.$ = {};
    }
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = manifest.application?.[0];
    if (!application) {
      return config;
    }

    const metaDataList = application['meta-data'] || [];
    const existing = metaDataList.find((item) => item.$?.['android:name'] === META_NAME);
    if (existing) {
      existing.$['tools:replace'] = 'android:resource';
    } else {
      metaDataList.push({
        $: {
          'android:name': META_NAME,
          'android:resource': '@color/notification_icon_color',
          'tools:replace': 'android:resource',
        },
      });
    }
    application['meta-data'] = metaDataList;

    return config;
  });
};
