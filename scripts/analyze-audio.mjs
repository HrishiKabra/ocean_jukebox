import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAudioArtifact,
  trackId,
} from '../app-core.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);
const catalogPath = join(rootDir, 'sounds.json');
const artifactsJsonPath = join(rootDir, 'audio-artifacts.json');
const artifactsJsPath = join(rootDir, 'audio-artifacts.js');
const waveformDir = join(rootDir, 'waveforms');

function parseArgs(args) {
  const options = {
    analyzeMedia: false,
    limit: Infinity,
    tracks: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--analyze-media') {
      options.analyzeMedia = true;
    } else if (arg === '--limit') {
      options.limit = Number(args[index + 1] || Infinity);
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
    } else if (arg === '--track') {
      options.tracks.push(args[index + 1]);
      index += 1;
    } else if (!arg.startsWith('--')) {
      options.tracks.push(arg);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit <= 0) {
    options.limit = Infinity;
  }

  return options;
}

function runCommand(command, args, { encoding = 'utf8' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', code => {
      const errorText = Buffer.concat(stderr).toString('utf8').trim();
      if (code !== 0) {
        reject(new Error(errorText || `${command} exited with code ${code}`));
        return;
      }
      const output = Buffer.concat(stdout);
      resolve(encoding === null ? output : output.toString(encoding));
    });
  });
}

async function probeAudio(url) {
  const output = await runCommand('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-show_entries',
    'stream=sample_rate,channels',
    '-of',
    'json',
    url,
  ]);
  const data = JSON.parse(output);
  const stream = (data.streams || [])[0] || {};
  return {
    durationSeconds: Number(data.format?.duration),
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
  };
}

function buildPeaksFromPcm(buffer, targetLength = 256) {
  const sampleCount = Math.floor(buffer.length / 4);
  if (!sampleCount) return [];
  const bucketSize = Math.max(1, Math.floor(sampleCount / targetLength));
  const peaks = [];

  for (let sample = 0; sample < sampleCount; sample += bucketSize) {
    let max = 0;
    const end = Math.min(sample + bucketSize, sampleCount);
    for (let offset = sample; offset < end; offset += 1) {
      max = Math.max(max, Math.abs(buffer.readFloatLE(offset * 4)));
    }
    peaks.push(Number(Math.min(1, max).toFixed(4)));
  }

  return peaks;
}

async function extractPeaks(url) {
  const pcm = await runCommand('ffmpeg', [
    '-v',
    'error',
    '-i',
    url,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '8000',
    '-f',
    'f32le',
    '-',
  ], { encoding: null });
  return buildPeaksFromPcm(pcm);
}

function selectTracks(catalog, options) {
  const tracks = catalog.tracks || [];
  if (!options.tracks.length) return tracks.slice(0, options.limit);
  const requested = new Set(options.tracks);
  return tracks
    .filter(track => requested.has(track.filename) || requested.has(trackId(track)))
    .slice(0, options.limit);
}

async function analyzeTrack(track, options, generatedAt) {
  if (!options.analyzeMedia) {
    return buildAudioArtifact(track, { generatedAt });
  }

  try {
    const [probe, peaks] = await Promise.all([
      probeAudio(track.url),
      extractPeaks(track.url),
    ]);
    return buildAudioArtifact(track, { probe, peaks, generatedAt });
  } catch (error) {
    return {
      ...buildAudioArtifact(track, { generatedAt }),
      analysisStatus: 'preview',
      analysisError: error.message,
    };
  }
}

function buildJsWrapper(report) {
  return `window.OCEAN_JUKEBOX_AUDIO_ARTIFACTS = ${JSON.stringify(report, null, 2)};\n`;
}

const options = parseArgs(process.argv.slice(2));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const selectedTracks = selectTracks(catalog, options);
const generatedAt = new Date().toISOString();
const artifacts = {};

await mkdir(waveformDir, { recursive: true });

for (const track of selectedTracks) {
  artifacts[trackId(track)] = await analyzeTrack(track, options, generatedAt);
}

const report = {
  generatedAt,
  mediaAnalysis: options.analyzeMedia ? 'attempted' : 'preview-only',
  totalCatalogTracks: (catalog.tracks || []).length,
  analyzedTracks: selectedTracks.length,
  artifacts,
};

await writeFile(artifactsJsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(artifactsJsPath, buildJsWrapper(report));

const analyzed = Object.values(artifacts).filter(artifact => artifact.analysisStatus === 'analyzed').length;
console.log(`Wrote audio-artifacts.json and audio-artifacts.js for ${selectedTracks.length} tracks (${analyzed} analyzed, ${selectedTracks.length - analyzed} preview).`);
