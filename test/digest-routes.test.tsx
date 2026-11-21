import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

// runs/ is read-only: every test builds its own runs dir.
function appWith(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(runsDir, name), text);
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
}

const line = (job: string, status: string, owner: string | null = 'rook', at = '2026-11-01T01:00:00+01:00') =>
  JSON.stringify({ at, job, status, owner });

const night = [
  line('b/job', 'ok'),
  line('a/job', 'retry'),
  line('a/job', 'retry'),
  line('a/job', 'retry'),
  line('a/job', 'ok'),
  line('c/job', 'fail', null),
  '{"at":"2026-11-01T02:00:0',
].join('\n');

describe('GET /digest/:night', () => {
  it('renders the rows sorted by job, with flags and the bad-line count', async () => {
    const res = await appWith({ '2026-11-01.jsonl': night }).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html.indexOf('b/job')).toBeLessThan(html.indexOf('c/job'));
    expect(html).toContain('3 retries');
    expect(html).toContain('fail');
    expect(html).toContain('1 log line could not be read');
    expect(html).toContain('—');
  });

  it('renders the real night on disk', async () => {
    const app = createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'runs' });
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('fixtures/refresh');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await appWith({}).request('/digest/2026-11-09');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty file', async () => {
    const res = await appWith({ '2026-11-02.jsonl': '' }).request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the same jobs, in the same order, as the page', async () => {
    const app = appWith({ '2026-11-01.jsonl': night });
    const res = await app.request('/api/digest/2026-11-01');
    const json = (await res.json()) as NightDigest;
    const html = await (await app.request('/digest/2026-11-01')).text();
    expect(res.status).toBe(200);
    const jobs = json.rows.map((r) => r.job);
    expect(jobs).toEqual(['a/job', 'b/job', 'c/job']);
    const positions = jobs.map((j) => html.indexOf(j));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
    expect(json.badLines).toBe(1);
    expect(json.rows[2]!.owner).toBeNull();
  });

  it('returns 404 for a night with no file', async () => {
    const res = await appWith({}).request('/api/digest/2026-11-09');
    expect(res.status).toBe(404);
  });

  it('returns no rows for an empty file', async () => {
    const res = await appWith({ '2026-11-02.jsonl': '' }).request('/api/digest/2026-11-02');
    expect(((await res.json()) as NightDigest).rows).toEqual([]);
  });
});

describe('status board links', () => {
  it('links each night on disk to its digest with counts', async () => {
    const app = createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'runs' });
    const html = await (await app.request('/')).text();
    for (const n of ['2026-10-27', '2026-10-28']) {
      expect(html).toContain(`href="/digest/${n}"`);
      expect((await app.request(`/digest/${n}`)).status).toBe(200);
    }
    expect(html).toMatch(/ok \d+ · retry \d+ · fail \d+/);
  });
});
