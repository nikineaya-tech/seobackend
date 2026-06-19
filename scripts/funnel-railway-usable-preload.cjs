'use strict';

/**
 * Daka Funnel Railway Usable Preload
 *
 * Runtime source patch for server.js only. It keeps Railway compact scrape
 * results from being treated as empty/bot-blocked when they contain sections,
 * body text, or price evidence, and builds a small synthetic HTML shell so the
 * existing funnel extractor can continue without returning EMPTY_SCRAPE_RESULT.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const MARKER = 'DAKA_RAILWAY_USABLE_PRELOAD_V1';

if (!global.__DAKA_RAILWAY_USABLE_PRELOAD__) {
  global.__DAKA_RAILWAY_USABLE_PRELOAD__ = true;
  patchServerLoader();
  console.log('[FunnelRailwayUsable] Runtime deepScrapeFunnel guard enabled');
}

function patchServerLoader() {
  const originalLoader = Module._extensions['.js'];

  Module._extensions['.js'] = function dakaRailwayUsableLoader(module, filename) {
    if (path.basename(filename) !== 'server.js') {
      return originalLoader(module, filename);
    }

    let source = fs.readFileSync(filename, 'utf8');
    try {
      source = patchServerSource(source);
    } catch (error) {
      console.warn('[FunnelRailwayUsable] server.js patch skipped:', error.message);
    }

    return module._compile(source, filename);
  };
}

function patchServerSource(source) {
  if (source.includes(MARKER)) return source;

  let patched = source;

  patched = patched.replace(
    '        let scrapeResult = await scrapeStealth(url);',
    `        let scrapeResult = await scrapeStealth(url);
        // ${MARKER}: normalize Railway compact result before completeness checks
        scrapeResult = normalizeScrapeForFunnel(scrapeResult);

        const hasRailwaySections =
            Array.isArray(scrapeResult?.sectionRawBlocks) &&
            scrapeResult.sectionRawBlocks.length > 0;

        const hasRailwayBody =
            String(scrapeResult?.bodyText || scrapeResult?.text || scrapeResult?.content || '').length > 200;

        const railwayUsable =
            hasRailwaySections ||
            hasRailwayBody ||
            Boolean(scrapeResult?.priceIntel?.detected || scrapeResult?.priceIntel?.primaryPrice);

        console.log(
            '[DEEP SCRAPE] Railway normalized before check ' +
            'usable=' + railwayUsable + ' ' +
            'sections=' + (scrapeResult.sectionRawBlocks?.length || 0) + ' ' +
            'body=' + String(scrapeResult.bodyText || '').length + ' ' +
            'price=' + (scrapeResult?.priceIntel?.primaryPrice || 'N/A')
        );`
  );

  patched = patched.replace(
    '        if (detectBotBlocked(scrapeResult) && scrapeResult?.fetchLayer !== \'scrape.do\') {',
    `        if (!railwayUsable && detectBotBlocked(scrapeResult) && scrapeResult?.fetchLayer !== 'scrape.do') {`
  );

  patched = patched.replace(
    `        const html = scrapeResult?.html || '';
        if (!html || html.length < 200) {
            throw new Error('HTML vide ou insuffisant après scraping.');
        }`,
    `        let html = scrapeResult?.html || '';
        if ((!html || html.length < 200) && railwayUsable) {
            const compactBody = String(
                scrapeResult?.bodyText ||
                scrapeResult?.text ||
                scrapeResult?.content ||
                scrapeResult?.brand?.fullTextSample ||
                ''
            );

            const compactSections = Array.isArray(scrapeResult?.sectionRawBlocks)
                ? scrapeResult.sectionRawBlocks
                : Array.isArray(scrapeResult?.sectionsDetailed)
                    ? scrapeResult.sectionsDetailed
                    : Array.isArray(scrapeResult?.sections)
                        ? scrapeResult.sections
                        : [];

            const escapeHtml = (value = '') => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            const sectionHtml = compactSections.map((section, index) => {
                const title = section?.title || section?.type || 'Section ' + (index + 1);
                const text = section?.textPreview || section?.text ||
                    (Array.isArray(section?.paragraphs) ? section.paragraphs.join(' ') : '');
                return '<section data-railway-section="true"><h2>' + escapeHtml(title) +
                    '</h2><p>' + escapeHtml(text) + '</p></section>';
            }).join('');

            html = '<!doctype html><html><head><title>' +
                escapeHtml(scrapeResult?.title || scrapeResult?.h1 || url) +
                '</title><meta name="description" content="' +
                escapeHtml(scrapeResult?.metaDescription || scrapeResult?.meta?.description || '') +
                '"></head><body><main><p>' + escapeHtml(compactBody) +
                '</p>' + sectionHtml + '</main></body></html>';

            console.log(
                '[DEEP SCRAPE] Synthetic HTML built from Railway compact result ' +
                'sections=' + compactSections.length + ' body=' + compactBody.length
            );
        }

        if (!html || html.length < 200) {
            throw new Error('HTML vide ou insuffisant après scraping.');
        }`
  );

  if (!patched.includes(MARKER)) {
    throw new Error('expected deepScrapeFunnel anchors not found');
  }

  return patched;
}
