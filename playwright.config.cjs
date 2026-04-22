'use strict';

const { join } = require('path');

/**
 * @type {import("playwright").Configuration}
 * Équivalent exact du .puppeteerrc.cjs pour Playwright
 * Cache Chromium local → compatible Render Free
 */
module.exports = {
  // Cache local identique à l'approche Puppeteer
  cacheDirectory: join(__dirname, '.cache', 'playwright'),
};