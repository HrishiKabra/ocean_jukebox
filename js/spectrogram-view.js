import { buildSpectrogramPath } from '../app-core.mjs';
import { currentTrack } from './app-state.js';

export function renderSpectrogram(state, els) {
  if (!els.spectrogramPanel || !els.spectrogramEmpty || !els.spectrogramImg) return;
  const track = currentTrack(state);
  els.spectrogramImg.hidden = true;
  els.spectrogramEmpty.hidden = true;
  els.spectrogramImg.removeAttribute('src');

  if (!track) {
    els.spectrogramEmpty.hidden = false;
    return;
  }

  const path = buildSpectrogramPath(track);
  els.spectrogramImg.alt = `Spectrogram for ${track.label}`;
  els.spectrogramImg.onload = () => {
    if (els.spectrogramImg.getAttribute('src') !== path) return;
    els.spectrogramImg.hidden = false;
    els.spectrogramEmpty.hidden = true;
  };
  els.spectrogramImg.onerror = () => {
    if (els.spectrogramImg.getAttribute('src') !== path) return;
    els.spectrogramImg.hidden = true;
    els.spectrogramEmpty.hidden = false;
  };
  els.spectrogramImg.src = path;
}
