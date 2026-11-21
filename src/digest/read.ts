import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type Entry = {
  at: string;
  ms: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: ReadonlySet<string> = new Set<RunStatus>(['ok', 'retry', 'fail']);

// Parse at the edge: a line is an Entry or it is bad. Never throws.
function parseLine(line: string): Entry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.has(status)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return null;
  return { at, ms, job, status: status as RunStatus, owner: owner ?? null, error: error ?? null };
}

type Acc = { row: DigestRow; firstMs: number; lastMs: number };

export const readNight: ReadNight = (runsDir, night): NightDigest | null => {
  // The night comes from a URL: only a plain date may reach the file system.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  const jobs = new Map<string, Acc>();
  let badLines = 0;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const e = parseLine(line);
    if (!e) {
      badLines++;
      continue;
    }
    counts[e.status]++;
    const acc = jobs.get(e.job);
    if (!acc) {
      jobs.set(e.job, {
        firstMs: e.ms,
        lastMs: e.ms,
        row: {
          job: e.job,
          owner: e.owner,
          runs: 1,
          retries: e.status === 'retry' ? 1 : 0,
          lastStatus: e.status,
          lastError: e.error,
          first: e.at,
          last: e.at,
        },
      });
      continue;
    }
    const { row } = acc;
    row.runs++;
    if (e.status === 'retry') row.retries++;
    if (e.error !== null) row.lastError = e.error;
    if (e.ms < acc.firstMs) {
      acc.firstMs = e.ms;
      row.first = e.at;
    }
    if (e.ms >= acc.lastMs) {
      acc.lastMs = e.ms;
      row.last = e.at;
      row.lastStatus = e.status;
      row.owner = e.owner;
    }
  }

  const rows = [...jobs.values()].map((a) => a.row).sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, counts, badLines };
};
