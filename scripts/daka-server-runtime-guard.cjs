#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const HARDENING_TAG = '<script src="/assets/daka-library-reader-hardening.js?v=20260826-reader-auto-fullscreen-fit3" defer></script>';
const HARDENING_TAG_PATTERN = /<script[^>]+src=["'][^"']*\/assets\/daka-library-reader-hardening\.js[^"']*["'][^>]*><\/script>/i;

function ensureLibraryReaderHardening() {
  try {
    if (!fs.existsSync(INDEX_PATH)) {
      console.warn('[DakaRuntimeGuard] index.html introuvable, injection PDF reader ignoree');
      return;
    }

    const current = fs.readFileSync(INDEX_PATH, 'utf8');
    const next = HARDENING_TAG_PATTERN.test(current)
      ? current.replace(HARDENING_TAG_PATTERN, HARDENING_TAG)
      : /<\/body>/i.test(current)
      ? current.replace(/<\/body>/i, `  ${HARDENING_TAG}\n</body>`)
      : `${current}\n${HARDENING_TAG}\n`;

    if (next !== current) {
      fs.writeFileSync(INDEX_PATH, next, 'utf8');
      console.log('[DakaRuntimeGuard] PDF reader fullscreen/secure hardening synchronise');
    } else {
      console.log('[DakaRuntimeGuard] PDF reader hardening deja synchronise');
    }
  } catch (error) {
    console.warn('[DakaRuntimeGuard] Injection PDF reader impossible:', error && error.message ? error.message : error);
  }
}

ensureLibraryReaderHardening();
require(path.join(ROOT_DIR, 'server.js'));
