import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { renderCatalogReport, validateCatalog } from './catalog.mjs';

async function main() {
  const catalogUrl = new URL('../sounds.json', import.meta.url);
  const reportJsonUrl = new URL('../catalog-report.json', import.meta.url);
  const reportMarkdownUrl = new URL('../catalog-report.md', import.meta.url);
  const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
  const generatedAt = new Date().toISOString();
  const report = validateCatalog(catalog, { generatedAt });

  await writeFile(reportJsonUrl, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(reportMarkdownUrl, renderCatalogReport(report));

  console.log(`Catalog validation ${report.ok ? 'passed' : 'failed'}.`);
  console.log(`Tracks: ${report.summary.trackCount}`);
  console.log(`Errors: ${report.summary.errorCount}`);
  console.log(`Warnings: ${report.summary.warningCount}`);

  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
