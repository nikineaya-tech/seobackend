import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refonte = fs.readFileSync(path.join(root, 'public', 'assets', 'daka-competitor-refonte.js'), 'utf8');

test('Competitor refonte is wired before deployment', () => {
  assert.match(index, /DAKA_USE_COMPETITOR_REFONTE\s*=\s*true/);
  const runtimePosition = index.indexOf('daka-main-runtime.js');
  const refontePosition = index.indexOf('daka-competitor-refonte.js');
  assert.ok(runtimePosition >= 0, 'main runtime script is missing');
  assert.ok(refontePosition > runtimePosition, 'refonte must load after the main runtime');
  assert.match(index, /daka-competitor-refonte\.js\?v=[^"']+/);
});

test('Competitor quality contract is present', () => {
  assert.match(refonte, /function qualityModel\(/);
  assert.match(refonte, /<small>\/10<\/small>/);
  assert.match(refonte, /canonicalSourceUrl/);
  assert.match(refonte, /daka-comp-quality-meter/);
  assert.match(refonte, /DAKA_USE_COMPETITOR_REFONTE|__dakaCompetitorRefonteRender/);
});
