import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSpectrogramPath } from '../app-core.mjs';

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', error => {
      reject(error);
    });
    child.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

const filename = process.argv[2];
if (!filename) {
  fail('Usage: node scripts/generate-spectrograms.mjs <filename-from-sounds-json>');
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);
const catalogPath = join(rootDir, 'sounds.json');
const spectrogramDir = join(rootDir, 'spectrograms');

let catalog;
try {
  catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
} catch (error) {
  fail(`Could not read sounds.json: ${error.message}`);
}

const track = (catalog.tracks || []).find(item => item.filename === filename);
if (!track) {
  fail(`No track found in sounds.json for filename "${filename}".`);
}
if (!track.url) {
  fail(`Track "${filename}" does not include a url.`);
}

await mkdir(spectrogramDir, { recursive: true });

const relativeOutput = buildSpectrogramPath(track);
const outputPath = join(rootDir, relativeOutput);
const filter = 'showspectrumpic=s=1200x520:legend=disabled:color=viridis';

try {
  await runFfmpeg([
    '-y',
    '-i',
    track.url,
    '-lavfi',
    filter,
    outputPath,
  ]);
} catch (error) {
  fail(`ffmpeg failed for "${filename}": ${error.message}`);
}

console.log(`Wrote ${relativeOutput}`);
