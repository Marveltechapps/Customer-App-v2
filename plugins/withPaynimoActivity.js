const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Plugin to register Paynimo WLCheckoutActivity in AndroidManifest.xml
 * Required for react-native-weipl-checkout to work properly
 */
module.exports = function withPaynimoActivity(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Ensure application exists
    if (!androidManifest.manifest.application) {
      androidManifest.manifest.application = [{}];
    }

    const application = androidManifest.manifest.application[0];

    // Ensure activity array exists
    if (!application.activity) {
      application.activity = [];
    }

    // Check if WLCheckoutActivity already exists
    const activityExists = application.activity.some(
      (activity) => activity.$['android:name'] === 'com.weipl.checkout.WLCheckoutActivity'
    );

    if (!activityExists) {
      // Add WLCheckoutActivity as required by Paynimo SDK
      application.activity.push({
        $: {
          'android:name': 'com.weipl.checkout.WLCheckoutActivity',
          'android:exported': 'true',
          'android:screenOrientation': 'portrait',
        },
      });
    }

    return config;
  });
};
