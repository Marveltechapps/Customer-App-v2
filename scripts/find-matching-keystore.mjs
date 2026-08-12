import fs from 'fs';
import path from 'path';
import os from 'os';

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const session = state.auth.sessionSecret;
const EXPECTED = 'D8:F5:84:68:1C:36:35:64:FC:47:12:5F:33:BD:A9:16:94:39:48:0A';
const CURRENT_WRONG = 'B5:6D:4E:A5:2B:43:AB:BE:4A:58:AA:FC:C5:ED:AA:A0:E6:3A:74:46';
const TARGET_PACKAGE = 'com.selorg.com';

async function gql(query, variables) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Expo-Session': session,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const appsRes = await gql(`{
  account {
    byName(accountName: "dhanasekaran08") {
      apps(offset: 0, limit: 50) {
        id
        name
        slug
        fullName
      }
    }
  }
}`);

if (appsRes.errors) {
  console.error('apps query failed', appsRes.errors);
  process.exit(1);
}

const apps = appsRes.data.account.byName.apps;
const matches = [];
const wrongMatches = [];

for (const app of apps) {
  const r = await gql(
    `query($appId: String!) {
      app {
        byId(appId: $appId) {
          id
          name
          slug
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
                sha256CertificateFingerprint
                md5CertificateFingerprint
              }
            }
          }
        }
      }
    }`,
    { appId: app.id }
  );

  if (r.errors) {
    console.log(`ERR ${app.fullName}:`, r.errors[0]?.message);
    continue;
  }

  const creds = r.data.app.byId.androidAppCredentials || [];
  for (const c of creds) {
    for (const b of c.androidAppBuildCredentialsList || []) {
      const ks = b.androidKeystore;
      if (!ks) continue;
      const sha1 = (ks.sha1CertificateFingerprint || '').toUpperCase();
      console.log(
        `${app.fullName} | pkg=${c.applicationIdentifier || '-'} | cred=${b.name} default=${b.isDefault} | alias=${ks.keyAlias} | SHA1=${sha1}`
      );
      if (sha1 === EXPECTED) {
        matches.push({ app, cred: c, buildCred: b, keystore: ks });
      }
      if (sha1 === CURRENT_WRONG) {
        wrongMatches.push({ app, cred: c, buildCred: b, keystore: ks });
      }
    }
  }
}

console.log('\n=== MATCH EXPECTED SHA1 ===');
console.log(
  matches.length
    ? matches
        .map(
          (m) =>
            `${m.app.fullName} pkg=${m.cred.applicationIdentifier} keystoreId=${m.keystore.id} buildCredId=${m.buildCred.id}`
        )
        .join('\n')
    : 'NONE'
);

console.log('\n=== MATCH CURRENT WRONG SHA1 ===');
console.log(
  wrongMatches.length
    ? wrongMatches
        .map(
          (m) =>
            `${m.app.fullName} pkg=${m.cred.applicationIdentifier} keystoreId=${m.keystore.id} buildCredId=${m.buildCred.id}`
        )
        .join('\n')
    : 'NONE'
);

if (!matches.length) {
  process.exit(2);
}

// Prefer match already on target package, else first match
const preferred =
  matches.find((m) => m.cred.applicationIdentifier === TARGET_PACKAGE) || matches[0];
const m = preferred;

const full = await gql(
  `query($id: ID!) {
    androidKeystore {
      byId(id: $id) {
        id
        keyAlias
        keystorePassword
        keyPassword
        keystore
        sha1CertificateFingerprint
      }
    }
  }`,
  { id: m.keystore.id }
);

console.log('\nDownload attempt errors:', JSON.stringify(full.errors || null));
const ks = full.data?.androidKeystore?.byId;
if (!ks?.keystore) {
  console.log('Could not download keystore bytes. Response:', JSON.stringify(full).slice(0, 800));
  process.exit(3);
}

const outDir = path.resolve('credentials');
fs.mkdirSync(outDir, { recursive: true });
const jksPath = path.join(outDir, 'customer-upload.jks');
fs.writeFileSync(jksPath, Buffer.from(ks.keystore, 'base64'));
const credJson = {
  android: {
    keystore: {
      keystorePath: './credentials/customer-upload.jks',
      keystorePassword: ks.keystorePassword,
      keyAlias: ks.keyAlias,
      keyPassword: ks.keyPassword,
    },
  },
};
fs.writeFileSync(path.join(outDir, 'credentials.json'), JSON.stringify(credJson, null, 2));
fs.writeFileSync('credentials.json', JSON.stringify(credJson, null, 2));
console.log('Wrote', jksPath);
console.log('SHA1', ks.sha1CertificateFingerprint);
console.log('Alias', ks.keyAlias);
console.log('Source app', m.app.fullName, m.cred.applicationIdentifier);
