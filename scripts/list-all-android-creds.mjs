import fs from 'fs';
import path from 'path';
import os from 'os';

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const session = state.auth.sessionSecret;
const EXPECTED = 'D8F584681C363564FC47125F33BDA9169439480A';
const WRONG = 'B56D4EA52B43ABBE4A58AAFCC5EDAAA0E63A7446';
const LOCAL = '0A7F209CF4F48AFE09960957B43E0C2D0F39078A';

function norm(s) {
  return (s || '').replace(/:/g, '').toUpperCase();
}

async function gql(query, variables) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Expo-Session': session },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const me = await gql(`{ meActor { __typename ... on UserActor { username id } } }`);
console.log('me', JSON.stringify(me.data || me.errors));

const appsRes = await gql(`{
  meActor {
    ... on UserActor {
      accounts {
        name
        apps(offset: 0, limit: 50) { id fullName name slug }
      }
    }
  }
}`);

if (appsRes.errors) {
  console.error(appsRes.errors);
  process.exit(1);
}

const accounts = appsRes.data.meActor.accounts || [];
for (const acc of accounts) {
  console.log('\nACCOUNT', acc.name);
  for (const app of acc.apps || []) {
    const r = await gql(
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
                  createdAt
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
        const sha = norm(b.androidKeystore?.sha1CertificateFingerprint);
        let tag = '';
        if (sha === EXPECTED) tag = ' <<< EXPECTED';
        if (sha === WRONG) tag = ' <<< WRONG';
        if (sha === LOCAL) tag = ' <<< LOCAL_MY_RELEASE';
        console.log(
          `${app.fullName} | ${c.applicationIdentifier} | ${b.androidKeystore?.sha1CertificateFingerprint}${tag}`
        );
      }
    }
  }
}
