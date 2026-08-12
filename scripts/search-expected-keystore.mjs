import fs from 'fs';
import path from 'path';
import os from 'os';

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const session = state.auth.sessionSecret;
const EXPECTED = 'D8F584681C363564FC47125F33BDA9169439480A';

async function gql(query, variables) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Expo-Session': session },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// Find AndroidKeystore query fields
const q = await gql(`{ __type(name: "AndroidKeystoreQuery") { fields { name args { name } } } }`);
console.log('AndroidKeystoreQuery', JSON.stringify(q.data || q.errors, null, 2));

const q2 = await gql(`{ __type(name: "Account") { fields { name } } }`);
const fields = (q2.data?.__type?.fields || []).map((f) => f.name).filter((n) => /android|keystore|credential|app/i.test(n));
console.log('Account fields:', fields.join(', '));

// Try account-level keystores if any
const acc = await gql(`{
  account {
    byName(accountName: "dhanasekaran08") {
      id
      name
    }
  }
}`);
console.log('account', JSON.stringify(acc.data || acc.errors));

// Download current wrong keystore for com.selorg.com just to document
const APP_ID = '39d49dd9-bb3f-4df8-abf8-ee0d5ed4fc0a';
const creds = await gql(
  `query($appId: String!) {
    app {
      byId(appId: $appId) {
        androidAppCredentials {
          id
          applicationIdentifier
          androidAppBuildCredentialsList {
            id
            name
            isDefault
            androidKeystore {
              id
              keyAlias
              sha1CertificateFingerprint
              keystore
              keystorePassword
              keyPassword
              createdAt
            }
          }
        }
      }
    }
  }`,
  { appId: APP_ID }
);
console.log(JSON.stringify(creds, null, 2).slice(0, 2500));

// Search all apps including with pagination for any matching sha
const apps = (
  await gql(`{
    account {
      byName(accountName: "dhanasekaran08") {
        apps(offset: 0, limit: 50) { id fullName }
      }
    }
  }`)
).data.account.byName.apps;

let found = false;
for (const app of apps) {
  const r = await gql(
    `query($appId: String!) {
      app {
        byId(appId: $appId) {
          androidAppCredentials {
            applicationIdentifier
            androidAppBuildCredentialsList {
              androidKeystore {
                id
                sha1CertificateFingerprint
                keystore
                keystorePassword
                keyAlias
                keyPassword
              }
            }
          }
        }
      }
    }`,
    { appId: app.id }
  );
  for (const c of r.data?.app?.byId?.androidAppCredentials || []) {
    for (const b of c.androidAppBuildCredentialsList || []) {
      const ks = b.androidKeystore;
      if (!ks) continue;
      const sha = (ks.sha1CertificateFingerprint || '').replace(/:/g, '').toUpperCase();
      if (sha === EXPECTED) {
        found = true;
        console.log('FOUND on', app.fullName, c.applicationIdentifier, ks.id);
        const outDir = path.resolve('credentials');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'customer-upload.jks'), Buffer.from(ks.keystore, 'base64'));
        fs.writeFileSync(
          'credentials.json',
          JSON.stringify(
            {
              android: {
                keystore: {
                  keystorePath: './credentials/customer-upload.jks',
                  keystorePassword: ks.keystorePassword,
                  keyAlias: ks.keyAlias,
                  keyPassword: ks.keyPassword,
                },
              },
            },
            null,
            2
          )
        );
      }
    }
  }
}
console.log(found ? 'MATCH SAVED' : 'NO MATCH ANYWHERE IN EAS');
