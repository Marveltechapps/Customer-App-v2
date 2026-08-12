/**
 * EAS / CI: confirm React Native Firebase packages resolved after npm install.
 * CocoaPods (RNFBApp, FirebaseMessaging) are validated in ios/Podfile post_install on Mac.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = ['@react-native-firebase/app', '@react-native-firebase/messaging'];
let failed = false;

for (const pkg of required) {
  const pkgJson = path.join(root, 'node_modules', ...pkg.split('/'), 'package.json');
  if (!fs.existsSync(pkgJson)) {
    console.error(`❌ Missing ${pkg} — FCM will not link on iOS/Android native builds`);
    failed = true;
    continue;
  }
  const { version } = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
  console.log(`✅ ${pkg}@${version}`);
}

process.exit(failed ? 1 : 0);
