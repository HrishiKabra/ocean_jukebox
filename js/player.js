import { currentTrack, recomputeVisible } from './app-state.js';
import { syncUrl } from './routes.js';

function setText(element, value) {
  if (element) element.textContent = value;
}

export function setPlayingState(state, els, value) {
  state.playing = value;
  if (els.waveform) els.waveform.classList.toggle('active', value);
  if (els.playIcon) els.playIcon.className = value ? 'ti ti-player-pause' : 'ti ti-player-play';
  if (els.playButton) els.playButton.setAttribute('aria-label', value ? 'Pause' : 'Play');
}

export function mediaUrl(track) {
  return track?.url || '';
}

export function setTrack(state, els, actions, index, options = {}) {
  if (!state.tracks[index]) return;

  state.currentIndex = index;
  const track = state.tracks[index];
  const src = mediaUrl(track);

  if (els.audio) {
    els.audio.src = src;
    setText(els.status, 'Loading audio metadata...');
    els.audio.load();
  }

  actions.renderAll();
  if (options.sync !== false) syncUrl(state, options.history);

  if (options.autoplay && els.audio) {
    els.audio.play()
      .then(() => setPlayingState(state, els, true))
      .catch(() => {
        setPlayingState(state, els, false);
        setText(els.status, 'This recording could not be played right now.');
      });
  }
}

export function playPause(state, els) {
  if (!currentTrack(state) || !els.audio) return;

  if (!state.playing) {
    els.audio.play()
      .then(() => setPlayingState(state, els, true))
      .catch(() => {
        setPlayingState(state, els, false);
        setText(els.status, 'This recording could not be played right now.');
      });
  } else {
    els.audio.pause();
    setPlayingState(state, els, false);
  }
}

export function navigate(state, els, actions, delta) {
  if (!state.visibleIndexes.length) return;
  const visiblePosition = state.visibleIndexes.indexOf(state.currentIndex);
  const safePosition = visiblePosition === -1 ? 0 : visiblePosition;
  const nextPosition = (safePosition + delta + state.visibleIndexes.length) % state.visibleIndexes.length;
  setTrack(state, els, actions, state.visibleIndexes[nextPosition], { autoplay: state.playing });
}

export function shuffleOrder(state, els, actions) {
  state.shuffled = !state.shuffled;
  state.order = state.tracks.map((_, index) => index);

  if (state.shuffled) {
    for (let i = state.order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
    }
  }

  if (els.shuffleButton) {
    els.shuffleButton.classList.toggle('active-btn', state.shuffled);
    els.shuffleButton.setAttribute('aria-pressed', state.shuffled ? 'true' : 'false');
  }
  recomputeVisible(state);
  actions.renderAll();
  syncUrl(state, 'pushState');
}

export function updateProgress(els) {
  if (!els.audio) return;
  const duration = els.audio.duration || 0;
  const current = els.audio.currentTime || 0;
  if (els.progress) {
    els.progress.max = duration || 0;
    els.progress.value = current;
  }
  if (els.time) {
    els.time.textContent = `${formatTime(current)} / ${duration ? formatTime(duration) : '0:00'}`;
  }
}

export function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function bindPlayerEvents(state, els, actions) {
  if (els.playButton) els.playButton.addEventListener('click', () => actions.playPause());
  if (els.prevButton) els.prevButton.addEventListener('click', () => actions.navigate(-1));
  if (els.nextButton) els.nextButton.addEventListener('click', () => actions.navigate(1));
  if (els.shuffleButton) {
    els.shuffleButton.addEventListener('click', () => actions.shuffleOrder());
  }
  if (els.progress && els.audio) {
    els.progress.addEventListener('input', () => {
      els.audio.currentTime = Number(els.progress.value);
    });
  }
  if (!els.audio) return;

  els.audio.addEventListener('play', () => setPlayingState(state, els, true));
  els.audio.addEventListener('pause', () => setPlayingState(state, els, false));
  els.audio.addEventListener('ended', () => actions.navigate(1));
  els.audio.addEventListener('timeupdate', () => updateProgress(els));
  els.audio.addEventListener('loadedmetadata', () => updateProgress(els));
  els.audio.addEventListener('canplay', () => {
    setText(els.status, '');
  });
  els.audio.addEventListener('waiting', () => {
    setText(els.status, 'Loading audio...');
  });
  els.audio.addEventListener('playing', () => {
    setText(els.status, '');
  });
  els.audio.addEventListener('error', () => {
    setText(els.status, 'This recording could not be loaded from NOAA right now.');
    setPlayingState(state, els, false);
  });
}
