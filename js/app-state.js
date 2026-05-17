import {
  buildVariantGroups,
  buildYearOptions,
  getVisibleIndexes,
  trackId,
} from '../app-core.mjs';

export const FALLBACK_CATALOG = {
  source: 'https://sanctsound.ioos.us/sounds.html',
  baseUrl: 'https://sanctsound.ioos.us/files/',
  generatedAt: null,
  archiveNote: 'NOAA SanctSound is a historical passive acoustic archive. These clips are recordings from the 2018-2021/2022 project period, not realtime audio.',
  tracks: [],
};

export function createAppState(globals = window) {
  const catalog = globals.OCEAN_JUKEBOX_CATALOG || FALLBACK_CATALOG;
  const tracks = catalog.tracks || [];
  return {
    catalog,
    sanctuaries: globals.OCEAN_JUKEBOX_SANCTUARIES || [],
    liveSources: globals.OCEAN_JUKEBOX_LIVE_SOURCES || [],
    audioArtifacts: globals.OCEAN_JUKEBOX_AUDIO_ARTIFACTS || { artifacts: {} },
    tracks,
    category: 'all',
    sanctuary: 'all',
    query: '',
    sort: 'curated',
    activeTab: 'archive',
    shuffled: false,
    order: tracks.map((_, index) => index),
    currentIndex: 0,
    visibleIndexes: tracks.map((_, index) => index),
    variantGroups: buildVariantGroups(tracks),
    playing: false,
    selectedYear: 'all',
    isApplyingRoute: false,
    leaflet: null,
    leafletLayer: null,
  };
}

export function currentTrack(state) {
  return state.tracks[state.currentIndex] || null;
}

export function currentAudioArtifact(state, track = currentTrack(state)) {
  if (!track) return null;
  return (state.audioArtifacts.artifacts || {})[trackId(track)] || null;
}

export function categoryList(state) {
  return ['all', ...new Set(state.tracks.map(track => track.category).filter(Boolean))];
}

export function sanctuaryList(state) {
  return ['all', ...new Set(state.tracks.map(track => track.sanctuary).filter(Boolean).sort())];
}

export function tabList() {
  return ['archive', 'map', 'live', 'spectrogram'];
}

export function yearList(state) {
  return buildYearOptions(state.tracks);
}

export function recomputeVisible(state) {
  state.visibleIndexes = getVisibleIndexes(state.tracks, state);
  if (state.visibleIndexes.length && !state.visibleIndexes.includes(state.currentIndex)) {
    state.currentIndex = state.visibleIndexes[0];
  }
}

export function setCurrentTrack(state, index) {
  if (Number.isInteger(index) && index >= 0 && index < state.tracks.length) {
    state.currentIndex = index;
  }
}
