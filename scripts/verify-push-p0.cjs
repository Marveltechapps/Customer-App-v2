/**
 * Verify P0 push / APNs / Firebase native prerequisites for Customer App.
 * Does not upload keys or call Firebase Console — checks local artifacts only.
 *
 * Usage: node scripts/verify-push-p0.mjs
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(root, '..');
const expectedKeyId = '2HVKPR57YW';
const expectedTeamId = '387A8ZCB5C';
const expectedBundle = 'com.selorg.com';

const results = [];

function ok(msg) {
  results.push({ ok: true, msg });
  console.log(`✅ ${msg}`);
}
function fail(msg) {
  results.push({ ok: false, msg });
  console.error(`❌ ${msg}`);
}
function warn(msg) {
  results.push({ ok: true, msg: `WARN: ${msg}` });
  console.warn(`⚠️  ${msg}`);
}

// 1) APNs Auth Key file
const apnsCandidates = [
  path.join(workspaceRoot, 'ios', `AuthKey_${expectedKeyId}.p8`),
  path.join(root, 'ios', `AuthKey_${expectedKeyId}.p8`),
  path.join(root, `AuthKey_${expectedKeyId}.p8`),
];
const apnsPath = apnsCandidates.find((p) => fs.existsSync(p));
if (apnsPath) {
  const raw = fs.readFileSync(apnsPath, 'utf8');
  const nameOk = path.basename(apnsPath) === `AuthKey_${expectedKeyId}.p8`;
  const pemOk = raw.includes('BEGIN PRIVATE KEY');
  if (nameOk && pemOk) {
    ok(`APNs Auth Key present: ${apnsPath} (Key ID ${expectedKeyId})`);
  } else {
    fail(`APNs Auth Key found but invalid PEM/name: ${apnsPath}`);
  }
} else {
  fail(`APNs AuthKey_${expectedKeyId}.p8 not found (expected under workspace ios/)`);
}

ok(`Expected Apple Team ID for Firebase Console upload: ${expectedTeamId}`);
warn(
  `Confirm in Firebase Console → Project settings → Cloud Messaging → Apple apps: Key ID ${expectedKeyId}, Team ID ${expectedTeamId}, bundle ${expectedBundle} are uploaded.`
);

// 2) GoogleService-Info.plist
const plistPath = path.join(root, 'GoogleService-Info.plist');
if (fs.existsSync(plistPath)) {
  const plist = fs.readFileSync(plistPath, 'utf8');
  const bundleMatch = plist.match(/<key>BUNDLE_ID<\/key>\s*<string>([^<]+)<\/string>/);
  const bundle = bundleMatch?.[1]?.trim();
  if (bundle === expectedBundle) {
    ok(`GoogleService-Info.plist BUNDLE_ID=${bundle}`);
  } else {
    fail(`GoogleService-Info.plist BUNDLE_ID mismatch: ${bundle}`);
  }
} else {
  fail('GoogleService-Info.plist missing at Customer-App-v2 root');
}

// 3) Entitlements aps-environment
const entitlementsPath = path.join(root, 'ios', 'Selorg', 'Selorg.entitlements');
if (fs.existsSync(entitlementsPath)) {
  const ent = fs.readFileSync(entitlementsPath, 'utf8');
  if (ent.includes('<string>production</string>')) {
    ok('Selorg.entitlements aps-environment=production (release default)');
  } else if (ent.includes('<string>development</string>')) {
    fail('Selorg.entitlements still set to development — release builds need production');
  } else {
    fail('Selorg.entitlements missing aps-environment');
  }
} else {
  fail('Selorg.entitlements missing');
}

// 4) app.config aps resolution (simulate release)
process.env.APS_ENVIRONMENT = 'production';
delete require.cache[require.resolve('../app.config.js')];
try {
  const config = require('../app.config.js');
  const aps = config?.expo?.ios?.entitlements?.['aps-environment'];
  const team = config?.expo?.ios?.appleTeamId;
  const apnsExtra = config?.expo?.extra?.apns;
  if (aps === 'production') ok(`app.config release aps-environment=${aps}`);
  else fail(`app.config release aps-environment=${aps} (expected production)`);
  if (team === expectedTeamId) ok(`app.config appleTeamId=${team}`);
  else fail(`app.config appleTeamId=${team} (expected ${expectedTeamId})`);
  if (apnsExtra?.keyId === expectedKeyId && apnsExtra?.teamId === expectedTeamId) {
    ok(`extra.apns keyId=${apnsExtra.keyId} teamId=${apnsExtra.teamId}`);
  } else {
    fail('extra.apns metadata mismatch');
  }
} catch (e) {
  fail(`Failed to load app.config.js: ${e.message}`);
}

// 5) RNFB packages
for (const pkg of ['@react-native-firebase/app', '@react-native-firebase/messaging']) {
  const pkgPath = path.join(root, 'node_modules', ...pkg.split('/'), 'package.json');
  if (fs.existsSync(pkgPath)) {
    const ver = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    ok(`${pkg}@${ver} installed`);
  } else {
    fail(`${pkg} missing from node_modules — run npm install`);
  }
}

// 6) Podfile.lock Firebase / RNFB
const lockPath = path.join(root, 'ios', 'Podfile.lock');
const isWin = process.platform === 'win32';
if (fs.existsSync(lockPath)) {
  const lock = fs.readFileSync(lockPath, 'utf8');
  const need = ['RNFBApp', 'RNFBMessaging', 'FirebaseMessaging', 'FirebaseCore'];
  const missing = need.filter((n) => !lock.includes(n));
  if (missing.length === 0) {
    ok('Podfile.lock contains RNFBApp, RNFBMessaging, FirebaseMessaging, FirebaseCore');
  } else if (isWin) {
    // CocoaPods cannot run on Windows; Podfile post_install will enforce on Mac/EAS.
    warn(
      `Podfile.lock missing ${missing.join(', ')} (expected on Windows). On macOS/EAS run: npm run ios:pods — Podfile post_install will fail the build if still missing.`
    );
  } else {
    fail(
      `Podfile.lock missing: ${missing.join(', ')}. Run: npm run ios:pods`
    );
  }
} else {
  fail('ios/Podfile.lock missing');
}

// 7) Android permissions
const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  const man = fs.readFileSync(manifestPath, 'utf8');
  const perms = ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED'];
  const missingPerms = perms.filter((p) => !man.includes(p));
  if (missingPerms.length === 0) {
    ok('AndroidManifest includes POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED');
  } else {
    fail(`AndroidManifest missing: ${missingPerms.join(', ')} — run: npx expo prebuild --platform android`);
  }
} else {
  fail('AndroidManifest.xml missing');
}

const failed = results.filter((r) => !r.ok).length;
console.log('');
console.log(failed === 0 ? 'P0 push verification: PASS' : `P0 push verification: FAIL (${failed} issue(s))`);
process.exit(failed === 0 ? 0 : 1);
