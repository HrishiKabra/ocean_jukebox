import { buildLiveSourceCards } from '../app-core.mjs';

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function appendLiveMeta(parent, label, value) {
  if (value === undefined || value === null || value === '') return;
  const item = document.createElement('span');
  item.textContent = `${label}: ${value}`;
  parent.appendChild(item);
}

export function renderLiveSources(state, els) {
  if (!els.liveGrid) return;
  els.liveGrid.innerHTML = '';

  const cards = buildLiveSourceCards(state.liveSources);
  if (!cards.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No live or near-live sources are configured.';
    els.liveGrid.appendChild(empty);
    return;
  }

  cards.forEach(source => {
    const card = document.createElement('article');
    card.className = `live-card ${source.playable ? 'playable' : 'check-only'}`;

    const header = document.createElement('div');
    header.className = 'live-card-head';

    const title = document.createElement('h3');
    title.textContent = source.name;
    header.appendChild(title);

    const status = document.createElement('span');
    status.className = `live-status ${source.status}`;
    status.textContent = source.statusLabel || source.status;
    if (source.statusDetail) status.title = source.statusDetail;
    header.appendChild(status);
    card.appendChild(header);

    const description = document.createElement('p');
    description.className = 'live-desc';
    description.textContent = source.description || 'No description available.';
    card.appendChild(description);

    const meta = document.createElement('div');
    meta.className = 'live-meta';
    appendLiveMeta(meta, 'Latency', source.latency);
    appendLiveMeta(meta, 'Location', source.location);
    if (source.checkedAt) appendLiveMeta(meta, 'Checked', formatDate(source.checkedAt));
    if (source.statusCode !== undefined) appendLiveMeta(meta, 'HTTP', source.statusCode);
    appendLiveMeta(meta, 'Status', source.statusDetail);
    card.appendChild(meta);

    const link = document.createElement('a');
    link.className = 'ctrl live-link';
    link.href = source.url || source.pageUrl || '#';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = source.actionLabel;
    card.appendChild(link);

    els.liveGrid.appendChild(card);
  });
}
