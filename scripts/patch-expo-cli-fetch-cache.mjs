#!/usr/bin/env node
/**
 * Patches @expo/cli wrapFetchWithCache so a failed cache write does not return a
 * Response whose body was already consumed by ReadableStream.tee().
 *
 * Without this, Metro start can crash with:
 *   TypeError: Body is unusable: Body has already been read
 *   at getNativeModuleVersionsAsync
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveWrapFetchWithCachePath() {
  try {
    const expoPkg = path.dirname(require.resolve('expo/package.json', { paths: [projectRoot] }));
    const nested = path.join(
      expoPkg,
      'node_modules',
      '@expo',
      'cli',
      'build',
      'src',
      'api',
      'rest',
      'cache',
      'wrapFetchWithCache.js'
    );
    if (fs.existsSync(nested)) return nested;
  } catch {
    // fall through
  }

  try {
    const cliPkg = path.dirname(
      require.resolve('@expo/cli/package.json', { paths: [projectRoot] })
    );
    const direct = path.join(
      cliPkg,
      'build',
      'src',
      'api',
      'rest',
      'cache',
      'wrapFetchWithCache.js'
    );
    if (fs.existsSync(direct)) return direct;
  } catch {
    // fall through
  }

  return null;
}

const target = resolveWrapFetchWithCachePath();
if (!target) {
  console.warn('[patch-expo-cli-fetch-cache] @expo/cli wrapFetchWithCache.js not found; skipping');
  process.exit(0);
}

const original = fs.readFileSync(target, 'utf8');
if (original.includes('SELORG_EXPO_CACHE_BODY_FIX')) {
  process.exit(0);
}

const broken = `            if (!cachedResponse) {
                debug(\`Failed to cache response for: \${url}\`);
                await cache.remove(cacheKey);
                return response;
            }`;

const fixed = `            if (!cachedResponse) {
                debug(\`Failed to cache response for: \${url}\`);
                await cache.remove(cacheKey);
                // SELORG_EXPO_CACHE_BODY_FIX: response.body was consumed by cache.tee(); re-fetch.
                return fetch(url, init);
            }`;

if (!original.includes(broken)) {
  console.warn(
    '[patch-expo-cli-fetch-cache] Expected cache-failure snippet not found; Expo CLI may have changed. Skipping.'
  );
  process.exit(0);
}

fs.writeFileSync(target, original.replace(broken, fixed), 'utf8');
console.log(`[patch-expo-cli-fetch-cache] Patched ${path.relative(projectRoot, target)}`);
