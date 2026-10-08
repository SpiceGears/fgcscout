import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'fgc2026-'));
try {
  execFileSync(process.execPath, ['frontend/node_modules/typescript/bin/tsc', 'frontend/src/lib/match2026.ts', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--outDir', directory], {stdio:'inherit'});
  const { braceLabel, suppressionPoints, formatRecorded } = createRequire(import.meta.url)(join(directory, 'match2026.js'));
  const data = JSON.parse(readFileSync('data-2026.json', 'utf8'));
  assert.equal(data.matches.filter(match => !match.played).length, 340);
  for (const match of data.matches.filter(match => match.played)) {
    for (const color of ['red', 'blue']) {
      const detail = match.details;
      const subtotal = suppressionPoints(detail[`wildfireIn${color === 'red' ? 'Red' : 'Blue'}SuppressionUnit`], detail[`${color}ClimbMultiplier`]);
      assert.equal(subtotal + detail[`${color}PartnerClimbPoints`] + detail.wildfireInExtinguisher + detail.coopertitionKnockdownBonus + detail.coopertition, match[`${color}Score`]);
    }
  }
  assert.equal(formatRecorded(0, false), '—');
  assert.equal(formatRecorded(0, true), '0');
  assert.equal(formatRecorded(null, true), '—');
  assert.equal(suppressionPoints(null, 1), null);
  assert.equal(suppressionPoints(100, 1.1), 110);
  assert.equal(braceLabel(.05), 'Contact');
  assert.equal(braceLabel(.3), 'Zone 3');
  console.log('2026 scoring passed: both real played matches, rounding, missing values and scheduled state.');
} finally { rmSync(directory, {recursive:true, force:true}); }
