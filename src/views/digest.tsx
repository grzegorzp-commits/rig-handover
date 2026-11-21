import type { DigestRow, NightDigest } from '../digest/types.js';

// Missing data renders as `—`, never as an empty cell (styleguide).
const dash = '—';

export function isFlagged(row: DigestRow): boolean {
  return row.lastStatus === 'fail' || row.retries >= 3;
}

function flag(row: DigestRow): string {
  const parts: string[] = [];
  if (row.lastStatus === 'fail') parts.push('fail');
  if (row.retries >= 3) parts.push(`${row.retries} retries`);
  return parts.length ? parts.join(', ') : dash;
}

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
              <th>flag</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((r) => (
              <tr class={isFlagged(r) ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.lastStatus}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.first}</td>
                <td>{r.last}</td>
                <td>{flag(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 ? (
        <p class="mute">{digest.badLines} log line{digest.badLines === 1 ? '' : 's'} could not be read</p>
      ) : null}
      <p class="mute">
        ok {digest.counts.ok} · retry {digest.counts.retry} · fail {digest.counts.fail}
      </p>
    </>
  );
}
