import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://sanctsound.ioos.us/sounds.html';
const NOAA_BASE = 'https://sanctsound.ioos.us/files/';

const SITE_SANCTUARIES = {
  CI: 'Channel Islands',
  FK: 'Florida Keys',
  GR: "Gray's Reef",
  HI: 'Hawaiian Islands',
  MB: 'Monterey Bay',
  OC: 'Olympic Coast',
  PM: 'Papahānaumokuākea',
  SB: 'Stellwagen Bank',
};

const CATEGORY_BY_SECTION = {
  fish: 'fish',
  invertebrates: 'invertebrate',
  'marine mammals': 'marine mammal',
  'vessel noise': 'vessel',
  'other anthropogenic sounds': 'human',
  weather: 'weather',
  other: 'soundscape',
};

const WHALE_RE = /\b(whale|whales|orca|orcas|dolphin|dolphins|porpoise|sei|minke|humpback|blue|fin|right|gray|sperm|killer)\b/i;

function cleanText(value) {
  return decodeEntities(String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-');
}

function normalizePath(src) {
  return src.replace(/^\.?\/*files\//, '').replace(/^files\//, '');
}

function normalizeSanctuary(value) {
  return cleanText(value)
    .replace(/Gray’s Reef/g, "Gray's Reef")
    .replace(/Hawaiian Islands Humpback Whale/g, 'Hawaiian Islands');
}

function normalizeLabel(value, isEnhanced = false) {
  const label = cleanText(value.replace(/\s*\([^)]*\)\s*$/, ''));
  return isEnhanced ? `${label} (enhanced)` : label;
}

export function parseTrackMetadata(filename) {
  const match = filename.match(/^SanctSound_([A-Z]{2}\d{2})_(\d{2})_(.+?)_(\d{8}T?\d{6}Z)/);
  if (!match) {
    return {
      site: null,
      deployment: null,
      soundSlug: filename.replace(/\.[^.]+$/, ''),
      recordedAt: null,
    };
  }
  const [, site, deployment, soundSlug, rawTimestamp] = match;
  const recordedAt = rawTimestamp.replace(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z$/,
    '$1-$2-$3T$4:$5:$6Z',
  );
  return { site, deployment, soundSlug, recordedAt };
}

function inferCategory(section, label, filename) {
  const sectionCategory = CATEGORY_BY_SECTION[section.toLowerCase()];
  if (sectionCategory === 'marine mammal' && WHALE_RE.test(`${label} ${filename}`)) {
    return /dolphin|porpoise/i.test(`${label} ${filename}`) ? 'dolphin' : 'whale';
  }
  if (sectionCategory) return sectionCategory;
  if (/ship|vessel|boat/i.test(`${label} ${filename}`)) return 'vessel';
  if (/sonar|pinger|sealbomb|explosion|scuba|echosounder/i.test(`${label} ${filename}`)) return 'human';
  if (/rain|wind|wave|hurricane|storm/i.test(`${label} ${filename}`)) return 'weather';
  if (/shrimp/i.test(`${label} ${filename}`)) return 'invertebrate';
  if (/soundscape|snapshot/i.test(label)) return 'soundscape';
  if (WHALE_RE.test(`${label} ${filename}`)) return /dolphin|porpoise/i.test(`${label} ${filename}`) ? 'dolphin' : 'whale';
  return 'soundscape';
}

function extractSanctuary(title, filename) {
  const headingMatch = title.match(/\(([^)]+)\)\s*$/);
  if (headingMatch) return normalizeSanctuary(headingMatch[1]);
  const site = parseTrackMetadata(filename).site;
  return site ? SITE_SANCTUARIES[site.slice(0, 2)] : 'Unknown';
}

function extractParagraph(block) {
  const withoutMediaParagraphs = block.replace(/<p>\s*(?:Enhanced\s*)?<audio[\s\S]*?<\/audio>\s*<\/p>/gi, '');
  const match = withoutMediaParagraphs.match(/<p>([\s\S]*?)<\/p>/i);
  return match ? cleanText(match[1]) : '';
}

export function parseSanctSoundHtml(html, catalogedAt = new Date().toISOString()) {
  const tracks = [];
  const tokenRe = /<h3[^>]*>([\s\S]*?)<\/h3>|<h4[^>]*>([\s\S]*?)<\/h4>|<source\s+[^>]*src=['"]([^'"]+)['"][^>]*>/gi;
  let currentSection = 'Other';
  let currentTitle = '';
  let lastIndex = 0;
  const seen = new Set();
  const tokens = [];
  let match;

  while ((match = tokenRe.exec(html))) {
    tokens.push({ match, index: match.index });
  }

  for (let i = 0; i < tokens.length; i++) {
    const { match: token, index } = tokens[i];
    const previousBlock = html.slice(lastIndex, index);
    lastIndex = index;

    if (token[1]) {
      currentSection = cleanText(token[1]);
      continue;
    }
    if (token[2]) {
      currentTitle = cleanText(token[2]);
      continue;
    }
    if (!token[3] || !currentTitle) continue;

    const filename = normalizePath(token[3]);
    if (seen.has(filename)) continue;
    seen.add(filename);

    const sourceType = /\.(wav|mp3|m4a|ogg)$/i.test(filename) ? 'audio' : 'video';
    const isEnhanced = /Enhanced/i.test(previousBlock) || /Speed|gain|dB/i.test(filename);
    const metadata = parseTrackMetadata(filename);
    const label = normalizeLabel(currentTitle, isEnhanced);
    const sanctuary = extractSanctuary(currentTitle, filename);

    tracks.push({
      filename,
      url: NOAA_BASE + filename,
      sanctuary,
      category: inferCategory(currentSection, label, filename),
      label,
      description: extractParagraph(html.slice(index, tokens[i + 1]?.index ?? html.length)),
      recordedAt: metadata.recordedAt,
      site: metadata.site,
      deployment: metadata.deployment,
      sourceType,
      sourcePage: SOURCE_URL,
      catalogedAt,
    });
  }

  return tracks;
}

export function mergeCatalogs(generated, curated) {
  const byFilename = new Map(curated.map(track => [track.filename, track]));
  return generated.map(track => {
    const local = byFilename.get(track.filename);
    if (!local) return track;
    return {
      ...track,
      sanctuary: local.sanctuary || track.sanctuary,
      category: local.category || track.category,
      label: local.label || track.label,
      description: local.description || track.description,
    };
  });
}

export function parseInlineCatalogFromHtml(html) {
  const match = html.match(/const SOUNDS = \[([\s\S]*?)\];/);
  if (!match) return [];
  const source = `[${match[1]}]`;
  const records = Function(`"use strict"; return (${source});`)();
  return records.map(record => ({
    filename: record.f,
    sanctuary: record.s,
    category: record.c,
    label: record.l,
    description: record.d,
  }));
}

export function parseCuratedCatalogJson(json) {
  const catalog = JSON.parse(json);
  return (catalog.tracks || []).map(track => ({
    filename: track.filename,
    sanctuary: track.sanctuary,
    category: track.category,
    label: track.label,
    description: track.description,
  }));
}

async function main() {
  const catalogedAt = new Date().toISOString();
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Could not fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`);
  }
  const sourceHtml = await response.text();
  let curated = [];
  try {
    curated = parseCuratedCatalogJson(await readFile(new URL('../sounds.json', import.meta.url), 'utf8'));
  } catch {
    const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    curated = parseInlineCatalogFromHtml(indexHtml);
  }
  const tracks = mergeCatalogs(parseSanctSoundHtml(sourceHtml, catalogedAt), curated);
  const catalog = {
    title: 'Ocean Jukebox Catalog',
    source: SOURCE_URL,
    baseUrl: NOAA_BASE,
    generatedAt: catalogedAt,
    archiveNote: 'NOAA SanctSound is a historical passive acoustic archive. These clips are recordings from the 2018-2021/2022 project period, not realtime audio.',
    tracks,
  };
  const json = JSON.stringify(catalog, null, 2);
  await writeFile(new URL('../sounds.json', import.meta.url), `${json}\n`);
  await writeFile(
    new URL('../sounds.js', import.meta.url),
    `window.OCEAN_JUKEBOX_CATALOG = ${json};\n`,
  );
  console.log(`Wrote sounds.json and sounds.js with ${tracks.length} tracks.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
