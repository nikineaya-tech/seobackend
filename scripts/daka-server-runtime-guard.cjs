#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const HARDENING_TAG = '<script src="/assets/daka-library-reader-hardening.js?v=20260826-reader-header-tools1" defer></script>';

function ensureLibraryReaderHardening() {
  try {
    if (!fs.existsSync(INDEX_PATH)) {
      console.warn('[DakaRuntimeGuard] index.html introuvable, injection PDF reader ignoree');
      return;
    }

    const current = fs.readFileSync(INDEX_PATH, 'utf8');
    if (current.includes('/assets/daka-library-reader-hardening.js')) {
      console.log('[DakaRuntimeGuard] PDF reader hardening deja present');
      return;
    }

    const next = /<\/body>/i.test(current)
      ? current.replace(/<\/body>/i, `  ${HARDENING_TAG}\n</body>`)
      : `${current}\n${HARDENING_TAG}\n`;

    fs.writeFileSync(INDEX_PATH, next, 'utf8');
    console.log('[DakaRuntimeGuard] PDF reader fullscreen/secure hardening injecte');
  } catch (error) {
    console.warn('[DakaRuntimeGuard] Injection PDF reader impossible:', error && error.message ? error.message : error);
  }
}

ensureLibraryReaderHardening();
require(path.join(ROOT_DIR, 'server.js'));
