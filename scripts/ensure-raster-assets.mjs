#!/usr/bin/env node
/**
 * Creates minimal placeholder PNG/JPG files for every static require() in src/.
 * Prevents Expo Go "Unable to resolve module …png" when lazy screens load.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(projectRoot, 'src');

/** 1×1 PNG (valid image bytes; works for .jpg requires too). */
const MIN_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPP/nwHDMDAwAAH0Af9RqH5jAAAAAElFTkSuQmCC',
  'base64',
);

const EXTRA_ROOT_ASSETS = [
  'assets/selorg-logo.png',
  'assets/splash.png',
];

function collectRequirePaths(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRequirePaths(full, acc);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const re = /require\s*\(\s*['"]([^'"]+\.(?:png|jpe?g))['"]\s*\)/gi;
    let match;
    while ((match = re.exec(text)) !== null) {
      acc.push({ file: full, spec: match[1] });
    }
  }
  return acc;
}

function resolveAssetPath(fromFile, spec) {
  if (spec.startsWith('@/')) {
    return path.join(srcRoot, spec.slice(2));
  }
  if (spec.startsWith('.')) {
    return path.normalize(path.join(path.dirname(fromFile), spec));
  }
  return path.join(projectRoot, spec);
}

function ensureFile(absPath) {
  if (fs.existsSync(absPath)) return false;
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, MIN_IMAGE);
  return true;
}

const refs = collectRequirePaths(srcRoot);
const targets = new Set(
  refs.map(({ file, spec }) => resolveAssetPath(file, spec)),
);

for (const rel of EXTRA_ROOT_ASSETS) {
  targets.add(path.join(projectRoot, rel));
}

let created = 0;
for (const abs of targets) {
  if (ensureFile(abs)) created += 1;
}

if (created > 0) {
  console.log(`[ensure-raster-assets] Created ${created} placeholder image(s).`);
} else {
  console.log('[ensure-raster-assets] All raster assets present.');
}
