#!/usr/bin/env node
/**
 * Patches @expo/cli bundledNativeModules so transient network failures (TypeError:
 * fetch failed) fall back to expo/bundledNativeModules.json instead of crashing Metro.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveBundledNativeModulesPath() {
  try {
    const expoPkg = path.dirname(require.resolve('expo/package.json', { paths: [projectRoot] }));
    const nested = path.join(
      expoPkg,
      'node_modules',
      '@expo',
      'cli',
      'build',
      'src',
      'start',
      'doctor',
      'dependencies',
      'bundledNativeModules.js'
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
      'start',
      'doctor',
      'dependencies',
      'bundledNativeModules.js'
    );
    if (fs.existsSync(direct)) return direct;
  } catch {
    // fall through
  }

  return null;
}

const target = resolveBundledNativeModulesPath();
if (!target) {
  console.warn(
    '[patch-expo-cli-network-fallback] bundledNativeModules.js not found; skipping'
  );
  process.exit(0);
}

const original = fs.readFileSync(target, 'utf8');
if (original.includes('SELORG_EXPO_NETWORK_FALLBACK')) {
  process.exit(0);
}

const broken = `        } catch (error) {
            if (error instanceof _errors.CommandError && (error.code === 'OFFLINE' || error.code === 'API')) {
                _log.warn((0, _chalk().default)\`Unable to reach well-known versions endpoint. Using local dependency map {bold expo/bundledNativeModules.json} for version validation\`);
            } else {
                throw error;
            }
        }`;

const fixed = `        } catch (error) {
            // SELORG_EXPO_NETWORK_FALLBACK: treat transient fetch failures like API errors
            const networkCodes = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET']);
            const isNetworkFailure = error && (error.message === 'fetch failed' || networkCodes.has(error.cause && error.cause.code));
            if (error instanceof _errors.CommandError && (error.code === 'OFFLINE' || error.code === 'API') || isNetworkFailure) {
                _log.warn((0, _chalk().default)\`Unable to reach well-known versions endpoint. Using local dependency map {bold expo/bundledNativeModules.json} for version validation\`);
            } else {
                throw error;
            }
        }`;

if (!original.includes(broken)) {
  console.warn(
    '[patch-expo-cli-network-fallback] Expected catch snippet not found; Expo CLI may have changed. Skipping.'
  );
  process.exit(0);
}

fs.writeFileSync(target, original.replace(broken, fixed), 'utf8');
console.log(`[patch-expo-cli-network-fallback] Patched ${path.relative(projectRoot, target)}`);
