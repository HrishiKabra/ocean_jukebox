import {
  CATEGORY_LABELS,
  SORT_LABELS,
  buildTrackDetail,
  formatCount,
  formatDate,
  trackId,
} from '../app-core.mjs';

import {
  categoryList,
  currentAudioArtifact,
  currentTrack,
  recomputeVisible,
  sanctuaryList,
  yearList,
} from './app-state.js';

import { syncUrl } from './routes.js';

export function updateMeta(state, els) {
  const generated = state.catalog.generatedAt ? formatDate(state.catalog.generatedAt) : 'Unknown';
  if (els.catalogMeta) {
    els.catalogMeta.textContent = `${formatCount(state.tracks.length)} from NOAA SanctSound · catalog refreshed ${generated}`;
  }
  if (els.archiveNote) {
    els.archiveNote.textContent = state.catalog.archiveNote || '';
  }
  if (els.resultCount) {
    els.resultCount.textContent = formatCount(state.visibleIndexes.length);
  }
}

export function renderWaveform(state, els, track) {
  if (!els.waveform) return;
  const artifact = track ? currentAudioArtifact(state, track) : null;
  const peaks = artifact?.waveformPeaks || [];
  const fallback = Array.from({ length: 32 }, (_, index) => 0.12 + Math.sin((index / 31) * Math.PI) * 0.42);
  const values = peaks.length ? peaks : fallback;

  els.waveform.innerHTML = '';
  values.forEach(value => {
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.style.height = `${Math.max(4, Math.round(Number(value) * 34))}px`;
    els.waveform.appendChild(bar);
  });
  els.waveform.setAttribute(
    'aria-label',
    artifact ? `Waveform preview generated ${formatDate(state.audioArtifacts.generatedAt)}` : 'Generated waveform preview',
  );
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Preview only';
  return formatTime(seconds);
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function renderVariantAlternates(state, els, actions, track) {
  const group = state.variantGroups.get(track.groupKey || trackId(track));
  els.detailVariants.innerHTML = '';
  if (!group) return;

  const alternates = [group.original, ...group.enhanced]
    .filter(variant => variant && variant !== track);
  if (!alternates.length) return;

  const label = document.createElement('span');
  label.className = 'variant-list-label';
  label.textContent = 'Alternates';
  els.detailVariants.appendChild(label);

  alternates.forEach(variant => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'variant-button';
    button.textContent = variant.variant === 'enhanced' ? 'Enhanced' : 'Original';
    button.setAttribute('aria-label', `Switch to ${variant.label}`);
    button.addEventListener('click', () => {
      const index = state.tracks.indexOf(variant);
      if (index >= 0) actions.setTrack(index, { autoplay: state.playing });
    });
    els.detailVariants.appendChild(button);
  });
}

export function renderTrackDetail(state, els, actions) {
  const track = currentTrack(state);
  if (!track) return;
  const detail = buildTrackDetail(track);
  const sourceUrl = detail.sourceUrl || track.url;

  els.detailTitle.textContent = detail.title;
  els.detailSanctuary.textContent = detail.sanctuary;
  els.detailCategory.textContent = detail.category;
  els.detailRecorded.textContent = detail.recorded;
  els.detailSite.textContent = detail.site;
  els.detailDeployment.textContent = detail.deployment;
  const artifact = currentAudioArtifact(state, track);
  const profile = artifact?.acousticProfile;
  els.detailDuration.textContent = formatDuration(profile?.durationSeconds);
  els.detailProfile.textContent = profile
    ? `${artifact.analysisStatus === 'analyzed' ? 'Analyzed' : 'Preview'} · ${profile.recordedYear || 'unknown year'} · ${profile.variant || 'original'}`
    : 'Catalog metadata';
  els.detailFilename.textContent = detail.filename;
  els.detailDescription.textContent = detail.description;
  els.detailSourceLink.href = sourceUrl;
  els.detailSourceLink.textContent = sourceUrl;
  renderVariantAlternates(state, els, actions, track);
}

export function openTrackDetail(els) {
  if (!els.detailPanel) return;
  els.detailPanel.hidden = false;
  els.detailsButton.setAttribute('aria-expanded', 'true');
  els.detailCloseButton.focus();
}

export function closeTrackDetail(els) {
  els.detailPanel.hidden = true;
  els.detailsButton.setAttribute('aria-expanded', 'false');
  els.detailsButton.focus();
}

export function copySourceUrl(state, els) {
  const track = currentTrack(state);
  if (!track) return;
  const sourceUrl = track.url;
  const clipboard = window.navigator && window.navigator.clipboard;
  if (!clipboard || !clipboard.writeText) {
    if (els.status) els.status.textContent = 'Copy unavailable in this browser.';
    return;
  }
  clipboard.writeText(sourceUrl)
    .then(() => {
      if (els.status) els.status.textContent = 'Source URL copied.';
    })
    .catch(() => {
      if (els.status) els.status.textContent = 'Copy unavailable in this browser.';
    });
}

export function syncControlsFromState(state, els) {
  if (els.query) els.query.value = state.query;
  if (els.sanctuarySelect) els.sanctuarySelect.value = state.sanctuary;
  if (els.sortSelect) els.sortSelect.value = state.sort;
  if (els.mapCategoryFilter) els.mapCategoryFilter.value = state.category;
  if (els.mapYearFilter) els.mapYearFilter.value = state.selectedYear;
}

export function buildFilters(state, els, actions) {
  if (els.categoryBar) {
    els.categoryBar.innerHTML = '';
    categoryList(state).forEach(category => {
      const button = document.createElement('button');
      button.className = `chip${category === state.category ? ' on' : ''}`;
      button.textContent = CATEGORY_LABELS[category] || category;
      button.setAttribute('aria-pressed', category === state.category ? 'true' : 'false');
      button.addEventListener('click', () => {
        state.category = category;
        recomputeVisible(state);
        syncUrl(state, 'pushState');
        actions.renderAll();
      });
      els.categoryBar.appendChild(button);
    });
  }

  if (els.sanctuarySelect) {
    els.sanctuarySelect.innerHTML = '';
    sanctuaryList(state).forEach(sanctuary => {
      const option = document.createElement('option');
      option.value = sanctuary;
      option.textContent = sanctuary === 'all' ? 'All sanctuaries' : sanctuary;
      els.sanctuarySelect.appendChild(option);
    });
  }

  if (els.mapCategoryFilter) {
    els.mapCategoryFilter.innerHTML = '';
    categoryList(state).forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = CATEGORY_LABELS[category] || category;
      els.mapCategoryFilter.appendChild(option);
    });
  }

  if (els.mapYearFilter) {
    els.mapYearFilter.innerHTML = '';
    yearList(state).forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year === 'all' ? 'All years' : year;
      els.mapYearFilter.appendChild(option);
    });
  }

  syncControlsFromState(state, els);
}

export function renderTrackList(state, els, actions) {
  if (!els.trackList) return;
  els.trackList.innerHTML = '';
  if (els.emptyState) els.emptyState.hidden = state.visibleIndexes.length > 0;
  const grouped = new Map();

  state.visibleIndexes.forEach(index => {
    const track = state.tracks[index];
    const groupName = state.sort === 'sanctuary' || state.sanctuary === 'all' ? track.sanctuary : CATEGORY_LABELS[track.category] || track.category;
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName).push(index);
  });

  grouped.forEach((indexes, groupName) => {
    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = groupName;
    els.trackList.appendChild(label);

    indexes.forEach(index => {
      const track = state.tracks[index];
      const row = document.createElement('button');
      row.className = `trow${index === state.currentIndex ? ' now' : ''}`;
      row.dataset.trackIndex = String(index);
      row.type = 'button';
      row.setAttribute('aria-label', `${track.label} - ${track.sanctuary}`);
      row.innerHTML = `
        <span class="t-num">${String(index + 1).padStart(2, '0')}</span>
        <span class="t-info">
          <span class="t-name">${track.label}</span>
          <span class="t-meta">${CATEGORY_LABELS[track.category] || track.category} · ${formatDate(track.recordedAt)} · ${track.site || 'site unknown'}</span>
        </span>
        <i class="ti ti-player-play t-play-icon" aria-hidden="true"></i>
      `;
      row.addEventListener('click', () => {
        actions.setTrack(index, { autoplay: true, history: 'pushState' });
      });
      els.trackList.appendChild(row);
    });
  });
  updateMeta(state, els);
}

export function highlightCurrent(state, els) {
  document.querySelectorAll('.trow').forEach(row => {
    row.classList.toggle('now', Number(row.dataset.trackIndex) === state.currentIndex);
  });
}
