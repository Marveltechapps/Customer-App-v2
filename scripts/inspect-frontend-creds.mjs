import fs from 'fs';
import path from 'path';
import os from 'os';

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const session = state.auth.sessionSecret;
const APP_ID = '39d49dd9-bb3f-4df8-abf8-ee0d5ed4fc0a'; // frontend / customer

async function gql(query, variables) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Expo-Session': session },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// Introspect AndroidAppCredentials for all keystore-related fields
for (const t of ['AndroidAppCredentials', 'AndroidKeystore', 'AndroidAppBuildCredentials']) {
  const r = await gql(`{ __type(name: "${t}") { fields { name type { name kind ofType { name } } } } }`);
  console.log('\n====', t, '====');
  console.log((r.data?.__type?.fields || []).map((f) => f.name).join(', '));
}

const full = await gql(
  `query($appId: String!) {
    app {
      byId(appId: $appId) {
        id
        fullName
        androidAppCredentials {
          id
          applicationIdentifier
          androidAppBuildCredentialsList {
            id
            name
            isDefault
            createdAt
            updatedAt
            androidKeystore {
              id
              keyAlias
              type
              md5CertificateFingerprint
              sha1CertificateFingerprint
              sha256CertificateFingerprint
              createdAt
              updatedAt
            }
          }
        }
      }
    }
  }`,
  { appId: APP_ID }
);
console.log('\n=== frontend credentials detail ===');
console.log(JSON.stringify(full, null, 2));

// Recent android builds - any credential metadata?
const builds = await gql(
  `query($appId: String!) {
    app {
      byId(appId: $appId) {
        builds(offset: 0, limit: 20, filter: { platform: android }) {
          id
          status
          createdAt
          distribution
          buildProfile
          appBuildVersion
          appVersion
        }
      }
    }
  }`,
  { appId: APP_ID }
);
console.log('\n=== recent builds ===');
console.log(JSON.stringify(builds.data?.app?.byId?.builds || builds.errors, null, 2));
