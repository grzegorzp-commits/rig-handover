// Morning digest: one row per job for one night's run log (plan.md § 1).
export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  // `null` when the log has no owner for the job; views show `—`.
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // Times keep the offset from the log, never converted to UTC.
  first: string;
  last: string;
};

export type NightDigest = {
  night: string;
  // Sorted by job, so the page and the JSON list jobs in the same order.
  rows: DigestRow[];
  // Run-log lines per status.
  counts: Record<RunStatus, number>;
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// Reads runs/<night>.jsonl. Returns null when the night has no file.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
