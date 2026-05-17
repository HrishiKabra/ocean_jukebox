import { currentTrack, recomputeVisible } from './app-state.js';
import { syncUrl } from './routes.js';

export function mediaUrl(track) {
  return track ? track.url : '';
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function setPlayingState(state, els, value) {
  state.playing = value;
  if (els.waveform) els.waveform.classList.toggle('active', value);
  if (els.playIcon) els.playIcon.className = value ? 'ti ti-player-pause' : 'ti ti-player-play';
  if (els.playButton) els.playButton.setAttribute('aria-label', value ? 'Pause' : 'Play');
}

export function setTrack(state, els, actions, index, options = {}) {
  if (!state.tracks[index]) return;
  state.currentIndex = index;
  const track = state.tracks[index];
  if (els.sanctuary) els.sanctuary.textContent = track.sanctuary;
  if (els.category) els.category.textContent = track.category;
  if (els.label) els.label.textContent = track.label;
  if (els.description) els.description.textContent = track.description || 'No description available from the source catalog.';
  if (els.date) els.date.textContent = track.recordedAt ? new Date(track.recordedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unknown date';
  if (els.site) els.site.textContent = track.site || 'Unknown site';
  if (els.file) els.file.textContent = track.filename;
  if (els.audio) {
    els.audio.src = mediaUrl(track);
    els.audio.load();
  }
  if (els.status) els.status.textContent = 'Loading audio metadata...';
  actions.renderAll();
  highlightCurrent(state, els);
  if (options.sync !== false) syncUrl(state, options.history);
  if (options.autoplay) {
    if (els.audio) {
      els.audio.play().then(() => setPlayingState(state, els, true)).catch(() => setPlayingState(state, els, false));
    }
  }
}

function highlightCurrent(state, els) {
  document.querySelectorAll('.trow').forEach(row => {
    row.classList.toggle('now', Number(row.dataset.trackIndex) === state.currentIndex);
  });
}

export function playPause(state, els) {
  if (!state.tracks.length) return;
  if (!state.playing) {
    if (els.audio) {
      els.audio.play().then(() => setPlayingState(state, els, true)).catch(() => {
        setPlayingState(state, els, false);
        if (els.status) els.status.textContent = 'Audio could not be played from the remote archive.';
      });
    }
  } else {
    if (els.audio) els.audio.pause();
    setPlayingState(state, els, false);
  }
}

export function navigate(state, els, actions, delta) {
  if (!state.visibleIndexes.length) return;
  const visiblePosition = state.visibleIndexes.indexOf(state.currentIndex);
  const safePosition = visiblePosition === -1 ? 0 : visiblePosition;
  const nextPosition = (safePosition + delta + state.visibleIndexes.length) % state.visibleIndexes.length;
  actions.setTrack(state.visibleIndexes[nextPosition], { autoplay: state.playing });
}

export function shuffleOrder(state, els, actions) {
  state.order = state.tracks.map((_, index) => index);
  if (state.shuffled) {
    for (let i = state.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    }
  }
  recomputeVisible(state);
  actions.renderAll();
}

function updateProgress(els) {
  if (!els.audio || !els.progress || !els.time) return;
  const duration = els.audio.duration || 0;
  const current = els.audio.currentTime || 0;
  els.progress.max = duration || 0;
  els.progress.value = current;
  els.time.textContent = `${formatTime(current)} / ${duration ? formatTime(duration) : '0:00'}`;
}

export function bindPlayerEvents(state, els, actions) {
  if (els.playButton) els.playButton.addEventListener('click', () => actions.playPause());
  if (els.prevButton) els.prevButton.addEventListener('click', () => actions.navigate(-1));
  if (els.nextButton) els.nextButton.addEventListener('click', () => actions.navigate(1));
  if (els.shuffleButton) {
    els.shuffleButton.addEventListener('click', () => {
      state.shuffled = !state.shuffled;
      els.shuffleButton.classList.toggle('active-btn', state.shuffled);
      shuffleOrder(state, els, actions);
      syncUrl(state, 'pushState');
    });
  }
  if (els.progress) {
    els.progress.addEventListener('input', () => {
      if (els.audio) els.audio.currentTime = Number(els.progress.value);
    });
  }
  if (els.audio) {
    els.audio.addEventListener('play', () => setPlayingState(state, els, true));
    els.audio.addEventListener('pause', () => setPlayingState(state, els, false));
    els.audio.addEventListener('ended', () => actions.navigate(1));
    els.audio.addEventListener('timeupdate', () => updateProgress(els));
    els.audio.addEventListener('loadedmetadata', () => updateProgress(els));
    els.audio.addEventListener('canplay', () => {
      if (els.status) els.status.textContent = '';
    });
    els.audio.addEventListener('waiting', () => {
      if (els.status) els.status.textContent = 'Loading audio...';
    });
    els.audio.addEventListener('playing', () => {
      if (els.status) els.status.textContent = '';
    });
    els.audio.addEventListener('error', () => {
      if (els.status) els.status.textContent = 'This recording could not be loaded from NOAA right now.';
      setPlayingState(state, els, false);
    });
  }
}
