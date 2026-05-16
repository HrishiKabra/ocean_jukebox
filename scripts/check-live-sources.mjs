import { readFile, writeFile } from 'node:fs/promises';

import { normalizeLiveSourceStatus } from '../app-core.mjs';

const liveSourcesUrl = new URL('../live-sources.js', import.meta.url);

function parseLiveSources(sourceText) {
  const match = sourceText.match(/window\.OCEAN_JUKEBOX_LIVE_SOURCES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not find window.OCEAN_JUKEBOX_LIVE_SOURCES assignment.');
  }
  return Function(`"use strict"; return (${match[1]});`)();
}

async function checkUrl(url) {
  let response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  if (response.status === 405 || response.status === 403) {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { Range: 'bytes=0-0' },
    });
  }
  return response;
}

async function checkSource(source, checkedAt) {
  const streamUrl = source.streamUrl && source.streamUrl.trim();
  const pageUrl = source.pageUrl && source.pageUrl.trim();
  const url = streamUrl || pageUrl;
  const kind = streamUrl ? 'stream' : 'page';

  if (!url) {
    return {
      ...source,
      ...normalizeLiveSourceStatus({
        ok: false,
        kind,
        statusCode: 0,
        checkedAt,
        error: 'No source URL configured.',
      }),
    };
  }

  try {
    const response = await checkUrl(url);
    return {
      ...source,
      ...normalizeLiveSourceStatus({
        ok: response.ok,
        kind,
        statusCode: response.status,
        checkedAt,
      }),
    };
  } catch (error) {
    return {
      ...source,
      ...normalizeLiveSourceStatus({
        ok: false,
        kind,
        statusCode: 0,
        checkedAt,
        error: error.message,
      }),
    };
  }
}

function serializeLiveSources(sources) {
  return `(function () {
  window.OCEAN_JUKEBOX_LIVE_SOURCES = ${JSON.stringify(sources, null, 2)};
}());
`;
}

const sourceText = await readFile(liveSourcesUrl, 'utf8');
const sources = parseLiveSources(sourceText);
const checkedAt = new Date().toISOString();
const checkedSources = [];

for (const source of sources) {
  checkedSources.push(await checkSource(source, checkedAt));
}

await writeFile(liveSourcesUrl, serializeLiveSources(checkedSources));

const summary = checkedSources
  .map(source => `${source.id}: ${source.statusLabel} (${source.statusCode || 'no HTTP status'})`)
  .join('\n');
console.log(`Checked ${checkedSources.length} live source${checkedSources.length === 1 ? '' : 's'}.\n${summary}`);
