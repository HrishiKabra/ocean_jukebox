import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyOverrides,
  backfillVariantDescriptions,
  buildGroupKey,
  mergeCatalogs,
  parseCuratedCatalogJson,
  parseSanctSoundHtml,
  parseTrackMetadata,
  renderCatalogReport,
  validateCatalog,
} from '../scripts/catalog.mjs';
import { validateValue } from '../scripts/validate-catalog-schema.mjs';

test('parses SanctSound media entries with headings, section category, sanctuary, and timestamp', () => {
  const html = `
    <h2>Animal</h2>
    <h3>Fish</h3>
    <h4>Bocaccio (Channel Islands)</h4>
    <video><source src='files/SanctSound_CI01_01_bocaccio_20181101T100353Z.mp4' type='video/mp4'></video>
    <p>Bocaccio produce low frequency sounds.</p>
    <h3>Marine mammals</h3>
    <h4>Blue whales (Monterey Bay)</h4>
    <video><source src='files/SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4' type='video/mp4'></video>
    <p>Low frequency blue whale calls.</p>
    <p>Enhanced <audio><source src='./files/SanctSound_MB01_01_bluewhale_20181123T203257Z_6xSpeed.wav.mp3' type='audio/wav'></audio></p>
  `;

  const tracks = parseSanctSoundHtml(html, '2026-05-15T00:00:00.000Z');

  assert.equal(tracks.length, 3);
  assert.deepEqual(
    tracks.map(track => ({
      filename: track.filename,
      sanctuary: track.sanctuary,
      category: track.category,
      label: track.label,
      sourceType: track.sourceType,
      recordedAt: track.recordedAt,
    })),
    [
      {
        filename: 'SanctSound_CI01_01_bocaccio_20181101T100353Z.mp4',
        sanctuary: 'Channel Islands',
        category: 'fish',
        label: 'Bocaccio',
        sourceType: 'video',
        recordedAt: '2018-11-01T10:03:53Z',
      },
      {
        filename: 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4',
        sanctuary: 'Monterey Bay',
        category: 'whale',
        label: 'Blue whales',
        sourceType: 'video',
        recordedAt: '2018-11-23T20:32:57Z',
      },
      {
        filename: 'SanctSound_MB01_01_bluewhale_20181123T203257Z_6xSpeed.wav.mp3',
        sanctuary: 'Monterey Bay',
        category: 'whale',
        label: 'Blue whales (enhanced)',
        sourceType: 'audio',
        recordedAt: '2018-11-23T20:32:57Z',
      },
    ],
  );
  assert.equal(tracks[0].description, 'Bocaccio produce low frequency sounds.');
});

test('merges generated tracks with curated records by filename', () => {
  const generated = [{
    filename: 'SanctSound_CI01_01_bocaccio_20181101T100353Z.mp4',
    sanctuary: 'Channel Islands',
    category: 'fish',
    label: 'Bocaccio',
    description: 'Generated NOAA description.',
    recordedAt: '2018-11-01T10:03:53Z',
    sourceType: 'video',
    catalogedAt: '2026-05-15T00:00:00.000Z',
  }];
  const curated = [{
    filename: 'SanctSound_CI01_01_bocaccio_20181101T100353Z.mp4',
    sanctuary: 'Channel Islands',
    category: 'fish',
    label: 'Bocaccio calls',
    description: 'Curated local description.',
  }];

  const [merged] = mergeCatalogs(generated, curated);

  assert.equal(merged.label, 'Bocaccio calls');
  assert.equal(merged.description, 'Curated local description.');
  assert.equal(merged.recordedAt, '2018-11-01T10:03:53Z');
  assert.equal(merged.catalogedAt, '2026-05-15T00:00:00.000Z');
});

test('parses site, deployment, sound slug, and timestamps from filenames', () => {
  assert.deepEqual(
    parseTrackMetadata('SanctSound_PM05_01_windwaves_20191113T090002Z_18dBgain.mp4'),
    {
      site: 'PM05',
      deployment: '01',
      soundSlug: 'windwaves',
      recordedAt: '2019-11-13T09:00:02Z',
    },
  );
});

test('parses compact NOAA timestamps without a T separator', () => {
  assert.deepEqual(
    parseTrackMetadata('SanctSound_PM02_02_soundscape_20201226093002Z.mp4'),
    {
      site: 'PM02',
      deployment: '02',
      soundSlug: 'soundscape',
      recordedAt: '2020-12-26T09:30:02Z',
    },
  );
});

test('builds matching group keys for original and enhanced variants', () => {
  assert.equal(
    buildGroupKey({
      site: 'CI05',
      deployment: '04',
      soundSlug: 'finwhale',
      recordedAt: '2019-12-28T13:41:33Z',
      filename: 'SanctSound_CI05_04_finwhale_20191228T134133Z.mp4',
    }),
    'CI05-04-finwhale-20191228T134133Z',
  );
  assert.equal(
    buildGroupKey({
      site: 'CI05',
      deployment: '04',
      soundSlug: 'finwhale',
      recordedAt: '2019-12-28T13:41:33Z',
      filename: 'SanctSound_CI05_04_finwhale_20191228T134133Z_6xSpeed.wav',
    }),
    'CI05-04-finwhale-20191228T134133Z',
  );
});

test('builds distinct group keys for same site deployment and slug at different timestamps', () => {
  assert.notEqual(
    buildGroupKey({
      site: 'PM02',
      deployment: '02',
      soundSlug: 'soundscape',
      recordedAt: '2020-12-26T09:30:02Z',
      filename: 'SanctSound_PM02_02_soundscape_20201226093002Z.mp4',
    }),
    buildGroupKey({
      site: 'PM02',
      deployment: '02',
      soundSlug: 'soundscape',
      recordedAt: '2021-01-04T11:12:13Z',
      filename: 'SanctSound_PM02_02_soundscape_20210104111213Z.mp4',
    }),
  );
});

test('keeps generated enhanced label when existing generated catalog has stale plain label', () => {
  const [merged] = mergeCatalogs([{
    filename: 'SanctSound_CI05_04_finwhale_20191228T134133Z_6xSpeed.wav',
    sanctuary: 'Channel Islands',
    category: 'whale',
    label: 'Fin whales (enhanced)',
    description: 'Generated NOAA description.',
    variant: 'enhanced',
  }], [{
    filename: 'SanctSound_CI05_04_finwhale_20191228T134133Z_6xSpeed.wav',
    sanctuary: 'Channel Islands',
    category: 'whale',
    label: 'Fin whales',
    description: 'Generated NOAA description.',
  }]);

  assert.equal(merged.label, 'Fin whales (enhanced)');
});

test('applies filename overrides after generated metadata', () => {
  const [track] = applyOverrides([{
    filename: 'haddock.mp4',
    label: 'Haddock',
    site: null,
    deployment: null,
    groupKey: 'haddock',
    variant: 'original',
  }], {
    'haddock.mp4': {
      site: 'SB01',
      deployment: '01',
      groupKey: 'SB01-01-haddock',
      variant: 'original',
    },
  });

  assert.equal(track.site, 'SB01');
  assert.equal(track.deployment, '01');
  assert.equal(track.groupKey, 'SB01-01-haddock');
  assert.equal(track.variant, 'original');
});

test('reads curated metadata from an existing generated catalog', () => {
  const curated = parseCuratedCatalogJson(JSON.stringify({
    tracks: [{
      filename: 'haddock.mp4',
      sanctuary: 'Stellwagen Bank',
      category: 'fish',
      label: 'Haddock knocks',
      description: 'Curated haddock note.',
    }],
  }));

  assert.deepEqual(curated, [{
    filename: 'haddock.mp4',
    sanctuary: 'Stellwagen Bank',
    category: 'fish',
    label: 'Haddock knocks',
    description: 'Curated haddock note.',
  }]);
});

test('validates catalog metadata, identity, URL, timestamp, sanctuary, and category issues', () => {
  const report = validateCatalog({
    tracks: [
      {
        filename: 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4',
        url: 'https://sanctsound.ioos.us/files/SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4',
        sanctuary: 'Monterey Bay',
        category: 'whale',
        label: 'Blue whale',
        description: 'Low frequency blue whale calls.',
        recordedAt: '2018-11-23T20:32:57Z',
      },
      {
        filename: 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4',
        url: 'notaurl',
        sanctuary: 'Missing Sanctuary',
        category: 'mystery',
        label: '',
        description: '',
        recordedAt: 'not-a-date',
      },
      {
        filename: 'SanctSound_FK01_01_missingtimestamp_20190101T000000Z.mp4',
        url: 'https://sanctsound.ioos.us/files/SanctSound_FK01_01_missingtimestamp_20190101T000000Z.mp4',
        sanctuary: 'Florida Keys',
        category: 'fish',
        label: 'No timestamp',
        description: 'Missing recordedAt.',
      },
      {
        id: 'custom-id',
        filename: 'custom-a.mp4',
        url: 'https://sanctsound.ioos.us/files/custom-a.mp4',
        sanctuary: 'Florida Keys',
        category: 'fish',
        label: 'Custom A',
        description: 'Valid custom track.',
        recordedAt: '2019-01-01T00:00:00Z',
      },
      {
        id: 'custom-id',
        filename: 'custom-b.mp4',
        url: 'https://sanctsound.ioos.us/files/custom-b.mp4',
        sanctuary: 'Florida Keys',
        category: 'fish',
        label: 'Custom B',
        description: 'Duplicate id.',
        recordedAt: '2019-01-02T00:00:00Z',
      },
    ],
  }, {
    generatedAt: '2026-05-15T00:00:00.000Z',
    sanctuaries: ['Monterey Bay', 'Florida Keys'],
    categories: ['whale', 'fish'],
  });

  assert.equal(report.ok, false);
  assert.equal(report.summary.trackCount, 5);
  assert.equal(report.summary.errorCount, 9);
  assert.deepEqual(
    report.issues.map(issue => [issue.code, issue.severity, issue.track]),
    [
      ['missing_label', 'error', 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4'],
      ['missing_description', 'error', 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4'],
      ['invalid_url', 'error', 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4'],
      ['invalid_recorded_at', 'error', 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4'],
      ['unknown_sanctuary', 'error', 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4'],
      ['unknown_category', 'error', 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4'],
      ['duplicate_filename', 'error', 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4'],
      ['missing_recorded_at', 'error', 'SanctSound_FK01_01_missingtimestamp_20190101T000000Z.mp4'],
      ['duplicate_id', 'error', 'custom-id'],
    ],
  );
});

test('allows nonstandard legacy filenames without recordedAt while validating supplied timestamps', () => {
  const report = validateCatalog({
    tracks: [{
      filename: 'haddock.mp4',
      url: 'https://sanctsound.ioos.us/files/haddock.mp4',
      sanctuary: 'Stellwagen Bank',
      category: 'fish',
      label: 'Haddock knocks',
      description: 'Legacy NOAA example clip without an encoded timestamp.',
      recordedAt: null,
    }],
  }, {
    generatedAt: '2026-05-15T00:00:00.000Z',
    sanctuaries: ['Stellwagen Bank'],
    categories: ['fish'],
  });

  assert.equal(report.ok, true);
});

test('backfills enhanced variant descriptions from the original grouped clip', () => {
  const tracks = backfillVariantDescriptions([
    {
      filename: 'original.mp4',
      groupKey: 'MB01-01-bluewhale-20181123T203257Z',
      variant: 'original',
      description: 'Low frequency blue whale calls.',
    },
    {
      filename: 'enhanced.wav',
      groupKey: 'MB01-01-bluewhale-20181123T203257Z',
      variant: 'enhanced',
      description: '',
    },
  ]);

  assert.equal(tracks[1].description, 'Low frequency blue whale calls.');
});

test('renders deterministic markdown report summary', () => {
  const report = validateCatalog({
    tracks: [{
      filename: 'SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4',
      url: 'https://sanctsound.ioos.us/files/SanctSound_MB01_01_bluewhale_20181123T203257Z.mp4',
      sanctuary: 'Monterey Bay',
      category: 'whale',
      label: 'Blue whale',
      description: 'Low frequency blue whale calls.',
      recordedAt: '2018-11-23T20:32:57Z',
    }],
  }, {
    generatedAt: '2026-05-15T00:00:00.000Z',
    sanctuaries: ['Monterey Bay'],
    categories: ['whale'],
  });

  assert.equal(renderCatalogReport(report), [
    '# Ocean Jukebox Catalog Validation Report',
    '',
    '- Generated: 2026-05-15T00:00:00.000Z',
    '- Status: PASS',
    '- Tracks: 1',
    '- Errors: 0',
    '- Warnings: 0',
    '',
    'No catalog issues found.',
    '',
  ].join('\n'));
});

test('reports schema required and enum errors with catalog paths', () => {
  const errors = validateValue({
    category: 'fish',
  }, {
    type: 'object',
    required: ['filename', 'category'],
    properties: {
      filename: { type: 'string' },
      category: { enum: ['whale'] },
    },
  });

  assert.deepEqual(errors, [
    '$.filename is required.',
    '$.category must be one of: whale.',
  ]);
});
