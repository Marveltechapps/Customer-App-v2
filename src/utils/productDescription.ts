/**
 * Structured product copy from API `description` (Mongo subdocument or legacy string).
 * Handles: camelCase / snake_case / alternate labels, and merged Excel-style blobs
 * ("About - ... Nutrition - ...") so all sections show in the Product Information UI.
 */

export interface ProductInformationBlock {
  key: string;
  label: string;
  text: string;
}

const ORDER: Array<{ key: string; label: string }> = [
  { key: 'about', label: 'About' },
  { key: 'healthBenefits', label: 'Health Benefits' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'originOfPlace', label: 'Origin of Place' },
];

function normKey(k: string): string {
  return k.toLowerCase().replace(/[_\s-]/g, '');
}

/** Read first matching key from API object (handles case / snake_case / synonyms). */
function pickFromObject(obj: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(obj);
  for (const cand of candidates) {
    const want = normKey(cand);
    for (const k of keys) {
      if (normKey(k) === want) {
        const v = obj[k];
        if (v != null && String(v).trim()) {
          return String(v).trim();
        }
      }
    }
  }
  return '';
}

export interface NormalizedDescription {
  about: string;
  healthBenefits: string;
  nutrition: string;
  originOfPlace: string;
  raw: string;
}

/** Normalize API `description` (string or object) to a fixed shape. */
export function normalizeDescriptionFromApi(description: unknown): NormalizedDescription {
  if (description == null) {
    return { about: '', healthBenefits: '', nutrition: '', originOfPlace: '', raw: '' };
  }
  if (typeof description === 'string') {
    const s = description.trim();
    return { about: s, healthBenefits: '', nutrition: '', originOfPlace: '', raw: s };
  }
  if (typeof description === 'object' && !Array.isArray(description)) {
    const d = description as Record<string, unknown>;
    const about = pickFromObject(d, ['about', 'About']) || String(d.about ?? '').trim();
    const healthBenefits =
      pickFromObject(d, ['healthBenefits', 'health_benefits', 'Health Benefits']) ||
      String(d.healthBenefits ?? '').trim();
    const nutrition = pickFromObject(d, ['nutrition', 'Nutrition']) || String(d.nutrition ?? '').trim();
    const originOfPlace =
      pickFromObject(d, [
        'originOfPlace',
        'origin_of_place',
        'placeOfOrigin',
        'place_of_origin',
        'Origin of Place',
        'Place of Origin',
      ]) || String(d.originOfPlace ?? '').trim();
    const raw =
      String(d.raw ?? '').trim() ||
      [about, healthBenefits, nutrition, originOfPlace].filter(Boolean).join(' ') ||
      about;
    return { about, healthBenefits, nutrition, originOfPlace, raw };
  }
  return { about: '', healthBenefits: '', nutrition: '', originOfPlace: '', raw: '' };
}

function countStructuredFields(d: NormalizedDescription): number {
  return [d.about, d.healthBenefits, d.nutrition, d.originOfPlace].filter((s) => s.trim().length > 0).length;
}

/** Same idea as skuMasterImport.splitDescription — case-insensitive section headers. */
function splitDescriptionPlainTextInsensitive(raw: string): Partial<NormalizedDescription> | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const patterns: Array<{ key: keyof Omit<NormalizedDescription, 'raw'>; prefix: string }> = [
    { key: 'about', prefix: 'About - ' },
    { key: 'nutrition', prefix: 'Nutrition - ' },
    { key: 'originOfPlace', prefix: 'Origin of Place - ' },
    { key: 'healthBenefits', prefix: 'Health Benefits - ' },
    { key: 'originOfPlace', prefix: 'Place of Origin - ' },
  ];

  const lower = trimmed.toLowerCase();
  const findPrefix = (prefix: string, from: number): number => lower.indexOf(prefix.toLowerCase(), from);

  const out: Record<string, string> = {
    about: '',
    nutrition: '',
    originOfPlace: '',
    healthBenefits: '',
  };

  for (let i = 0; i < patterns.length; i += 1) {
    const current = patterns[i];
    const start = findPrefix(current.prefix, 0);
    if (start === -1) {
      continue;
    }
    const plen = current.prefix.length;
    let end = trimmed.length;
    for (let j = 0; j < patterns.length; j += 1) {
      if (j === i) {
        continue;
      }
      const np = findPrefix(patterns[j].prefix, start + plen);
      if (np !== -1) {
        end = Math.min(end, np);
      }
    }
    const slice = trimmed.slice(start + plen, end).trim();
    const { key } = current;
    if (key === 'originOfPlace') {
      if (slice && !out.originOfPlace) {
        out.originOfPlace = slice;
      }
    } else if (!out[key] || slice.length > (out[key] || '').length) {
      out[key] = slice;
    }
  }

  const any = Object.values(out).some((s) => s.trim());
  if (!any) {
    return null;
  }
  return out as Partial<NormalizedDescription>;
}

/** Section headers inline (after punctuation) or at line start — not only after newlines. */
function sectionHeaderRegex(): RegExp {
  return /\b(About|Health Benefits|Nutrition|Origin of Place|Place of Origin)\s*-\s*/gi;
}

/**
 * Regex-based parser when headers appear in flexible order (matches import / human text).
 */
function parseSectionsWithRegex(blob: string): ProductInformationBlock[] | null {
  const t = blob.trim();
  if (!t) {
    return null;
  }
  const matches = [...t.matchAll(sectionHeaderRegex())];
  if (matches.length < 1) {
    return null;
  }

  const labelToKey = (lab: string): string => {
    const l = lab.toLowerCase();
    if (l === 'about') {
      return 'about';
    }
    if (l === 'health benefits') {
      return 'healthBenefits';
    }
    if (l === 'nutrition') {
      return 'nutrition';
    }
    if (l === 'origin of place' || l === 'place of origin') {
      return 'originOfPlace';
    }
    return 'about';
  };

  const blocks: ProductInformationBlock[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const lab = m[1];
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : t.length;
    const body = t.slice(start, end).trim();
    if (!body) {
      continue;
    }
    const key = labelToKey(lab);
    const label = ORDER.find((o) => o.key === key)?.label ?? lab;
    blocks.push({ key, label, text: body });
  }
  return blocks.length > 0 ? blocks : null;
}

function mergeDbAndSplit(
  d: NormalizedDescription,
  split: Partial<NormalizedDescription> | null,
): NormalizedDescription {
  if (!split) {
    return d;
  }
  if (countStructuredFields(d) >= 2) {
    return d;
  }

  const blob = (d.about || d.raw || '').trim();
  const hasMarkers = /(?:Nutrition|Health Benefits|Origin of Place|Place of Origin)\s*-\s*/i.test(blob);
  if (!hasMarkers) {
    return {
      about: d.about || split.about || '',
      healthBenefits: d.healthBenefits || split.healthBenefits || '',
      nutrition: d.nutrition || split.nutrition || '',
      originOfPlace: d.originOfPlace || split.originOfPlace || '',
      raw: d.raw || blob,
    };
  }

  return {
    about: (split.about ?? '').trim(),
    healthBenefits: (split.healthBenefits ?? '').trim() || d.healthBenefits,
    nutrition: (split.nutrition ?? '').trim() || d.nutrition,
    originOfPlace: (split.originOfPlace ?? '').trim() || d.originOfPlace,
    raw: d.raw || blob,
  };
}

function blocksFromStructured(d: NormalizedDescription): ProductInformationBlock[] {
  return ORDER.map(({ key, label }) => ({
    key,
    label,
    text: (d as Record<string, string>)[key] ?? '',
  })).filter((b) => b.text.trim().length > 0);
}

function sortBlocks(blocks: ProductInformationBlock[]): ProductInformationBlock[] {
  const seen = new Set<string>();
  const out: ProductInformationBlock[] = [];
  for (const o of ORDER) {
    const b = blocks.find((x) => x.key === o.key);
    if (b && b.text.trim() && !seen.has(b.key)) {
      seen.add(b.key);
      out.push({ ...b, label: o.label });
    }
  }
  return out;
}

/** Detect merged Excel-style blobs with 2+ section headers (case-insensitive). */
function hasMultipleSectionMarkers(blob: string): boolean {
  const matches = [...blob.matchAll(sectionHeaderRegex())];
  return matches.length >= 2;
}

/** When parsing a merged blob, prefer extracted sections over parallel DB fields. */
function mergeStructuredPreferringSplit(
  d: NormalizedDescription,
  split: Partial<NormalizedDescription>,
): NormalizedDescription {
  const pick = (key: keyof Omit<NormalizedDescription, 'raw'>): string => {
    const fromSplit = String((split as Record<string, string>)[key] ?? '').trim();
    const fromDb = String((d as Record<string, string>)[key] ?? '').trim();
    return fromSplit || fromDb;
  };
  return {
    about: pick('about'),
    healthBenefits: pick('healthBenefits'),
    nutrition: pick('nutrition'),
    originOfPlace: pick('originOfPlace'),
    raw: d.raw,
  };
}

/**
 * Parsed sections win over parallel DB fields for the same key.
 * If `about` holds the entire blob we parsed into sections but no `about` block was extracted,
 * skip the catch-all about line (avoids duplicating "Nutrition - …" under About).
 */
function mergeBlocksWithDb(
  parsed: ProductInformationBlock[],
  d: NormalizedDescription,
  blobSource: string,
): ProductInformationBlock[] {
  const byKey = new Map<string, ProductInformationBlock>();
  for (const b of parsed) {
    if (b.text.trim()) {
      byKey.set(b.key, b);
    }
  }
  const blobTrim = blobSource.trim();
  const aboutTrim = (d.about || '').trim();
  const headerCount = [...blobTrim.matchAll(sectionHeaderRegex())].length;
  const skipCatchAllAbout =
    parsed.length > 0 && !byKey.has('about') && aboutTrim === blobTrim && headerCount >= 1;

  for (const b of blocksFromStructured(d)) {
    if (!b.text.trim()) {
      continue;
    }
    if (skipCatchAllAbout && b.key === 'about') {
      continue;
    }
    if (!byKey.has(b.key)) {
      byKey.set(b.key, b);
    }
  }
  return sortBlocks([...byKey.values()]);
}

function tryParseBlobToBlocks(blob: string, d: NormalizedDescription): ProductInformationBlock[] {
  const regexBlocks = parseSectionsWithRegex(blob);
  if (regexBlocks && regexBlocks.length > 0) {
    return regexBlocks;
  }
  const split = splitDescriptionPlainTextInsensitive(blob);
  if (!split) {
    return [];
  }
  const merged = mergeStructuredPreferringSplit(d, split);
  return blocksFromStructured(merged);
}

/**
 * Non-empty blocks in display order (About → Health Benefits → Nutrition → Origin of Place).
 * Merges DB fields with parsed multi-section blobs when data is stored in one field.
 */
export function buildProductInformationBlocks(description: unknown): ProductInformationBlock[] {
  const d = normalizeDescriptionFromApi(description);
  const blob = (d.about || d.raw || '').trim();
  const dbBlocks = blocksFromStructured(d);

  // Merged blob in `about`/`raw` with multiple headers: parse before trusting countStructuredFields≥2
  // (avoids showing one giant "About" line or skipping split sections when DB also sets e.g. nutrition).
  if (blob && hasMultipleSectionMarkers(blob)) {
    const fromBlob = tryParseBlobToBlocks(blob, d);
    if (fromBlob.length > 0) {
      return mergeBlocksWithDb(fromBlob, d, blob);
    }
  }

  if (countStructuredFields(d) >= 2) {
    return sortBlocks(dbBlocks);
  }

  if (!blob) {
    return dbBlocks;
  }

  const regexBlocks = parseSectionsWithRegex(blob);
  if (regexBlocks && regexBlocks.length > 0) {
    return mergeBlocksWithDb(regexBlocks, d, blob);
  }

  const split = splitDescriptionPlainTextInsensitive(blob);
  const merged = mergeDbAndSplit(d, split);
  const mergedBlocks = blocksFromStructured(merged);
  if (mergedBlocks.length > 0) {
    return sortBlocks(mergedBlocks);
  }

  return [];
}

/**
 * SEO/meta fields often hold Origin / Health copy when `description` subdoc is partial (verified on live API).
 */
export function enrichDescriptionWithMeta(
  norm: NormalizedDescription,
  meta: { title?: string; description?: string } | undefined,
): NormalizedDescription {
  if (!meta || typeof meta !== 'object') {
    return norm;
  }
  const title = String(meta.title ?? '').trim();
  const metaDesc = String(meta.description ?? '').trim();
  const originMatch = /^Origin of Place\s*-\s*(.+)$/i.exec(title);
  const healthMatch = /^Health Benefits?\s*-\s*(.+)$/i.exec(metaDesc);

  const originOfPlace = norm.originOfPlace.trim() || (originMatch ? originMatch[1].trim() : '');
  const healthBenefits = norm.healthBenefits.trim() || (healthMatch ? healthMatch[1].trim() : '');

  return {
    ...norm,
    originOfPlace,
    healthBenefits,
  };
}

/** Single-line fallback for list/search snippets (legacy). */
export function descriptionFallbackText(description: unknown): string {
  const norm = normalizeDescriptionFromApi(description);
  if (norm.raw.trim()) {
    return norm.raw.trim();
  }
  const parts = [norm.about, norm.healthBenefits, norm.nutrition, norm.originOfPlace]
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(' ');
}
