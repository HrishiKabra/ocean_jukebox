import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const defaultLimit = Infinity;
const defaultTimeoutMs = 12000;
const catalogUrl = new URL('../sounds.json', import.meta.url);
const reportUrl = new URL('../catalog-source-report.json', import.meta.url);

function parsePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function parseArgs(args) {
  const options = {
    limit: defaultLimit,
    timeoutMs: defaultTimeoutMs,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--limit') {
      options.limit = parsePositiveNumber(args[index + 1], defaultLimit);
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parsePositiveNumber(arg.slice('--limit='.length), defaultLimit);
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = parsePositiveNumber(args[index + 1], defaultTimeoutMs);
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = parsePositiveNumber(arg.slice('--timeout-ms='.length), defaultTimeoutMs);
    }
  }

  return options;
}

export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = defaultTimeoutMs, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkSource(track, { timeoutMs = defaultTimeoutMs } = {}) {
  const baseResult = {
    filename: track.filename,
    label: track.label,
    url: track.url,
  };

  try {
    let response = await fetchWithTimeout(track.url, {
      method: 'HEAD',
      redirect: 'follow',
      timeoutMs,
    });
    let method = 'HEAD';

    if (response.status === 403 || response.status === 405 || response.status === 501) {
      response = await fetchWithTimeout(track.url, {
        method: 'GET',
        redirect: 'follow',
        headers: { Range: 'bytes=0-0' },
        timeoutMs,
      });
      method = 'GET range';
    }

    return {
      ...baseResult,
      ok: response.ok || response.status === 206,
      status: response.status,
      method,
    };
  } catch (error) {
    return {
      ...baseResult,
      ok: false,
      status: 0,
      method: 'HEAD',
      error: error.message,
    };
  }
}

async function readCatalog() {
  return JSON.parse(await readFile(catalogUrl, 'utf8'));
}

async function writeReport(report) {
  await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
}

export async function checkCatalogSources({ limit = defaultLimit, timeoutMs = defaultTimeoutMs } = {}) {
  const catalog = await readCatalog();
  const tracks = Array.isArray(catalog.tracks) ? catalog.tracks : [];
  const selectedTracks = tracks
    .filter(track => track.url)
    .slice(0, limit);
  const results = [];

  for (const track of selectedTracks) {
    results.push(await checkSource(track, { timeoutMs }));
  }

  const report = {
    checkedAt: new Date().toISOString(),
    totalCatalogTracks: tracks.length,
    checkedTracks: results.length,
    ok: results.every(result => result.ok),
    results,
  };

  await writeReport(report);
  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await checkCatalogSources(options);
  const reachable = report.results.filter(result => result.ok).length;
  const unavailable = report.results.length - reachable;

  console.log(`Checked ${report.checkedTracks} catalog source(s).`);
  console.log(`Reachable: ${reachable}`);
  console.log(`Unavailable: ${unavailable}`);

  if (unavailable > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
