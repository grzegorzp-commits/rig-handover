import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const d = readNight('runs', '2026-10-28');
    expect(d).not.toBeNull();
    expect(d!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(d!.badLines).toBe(1);
  });

  it('counts runs, retries, last status and last error per job', () => {
    const rows = Object.fromEntries(readNight('runs', '2026-10-28')!.rows.map((r) => [r.job, r]));
    expect(rows['fixtures/refresh']).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });
    expect(rows['notes/backup']).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(rows['lane/sync']).toMatchObject({ retries: 1, lastStatus: 'ok', lastError: 'lock held' });
  });

  it('keeps a row whose owner is null', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row!.owner).toBeNull();
  });

  it('counts log lines per status', () => {
    const d = readNight('runs', '2026-10-28')!;
    expect(d.counts.ok + d.counts.retry + d.counts.fail + d.badLines).toBe(16);
    expect(d.counts.fail).toBe(1);
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not a plain date', () => {
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('counts bad lines and never throws', () => {
    const dir = tempRuns({
      '2026-11-01.jsonl': [
        'not json',
        '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"boom","owner":null}',
        '[1,2]',
        '',
        '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"ok"}',
      ].join('\n'),
    });
    const d = readNight(dir, '2026-11-01')!;
    expect(d.badLines).toBe(3);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]!.owner).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    const dir = tempRuns({ '2026-11-02.jsonl': '' });
    expect(readNight(dir, '2026-11-02')).toMatchObject({ rows: [], badLines: 0 });
  });
});
