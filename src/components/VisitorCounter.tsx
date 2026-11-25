import { useEffect, useState } from 'react';

// Modern digital/LED-style total-visits counter, shown under the platform
// name in the header. The count lives in Cloudflare KV and is served by the
// Pages Function GET /api/visits (increments once per browser session — the
// sessionStorage guard below — or ?mode=peek to only read the total).
// If the endpoint is unavailable (e.g. the static GitHub Pages copy, which
// has no Functions), the counter simply renders nothing — never an error.
const COUNTED_FLAG = 'muadh-visits-counted';

export function VisitorCounter() {
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const alreadyCounted =
      sessionStorage.getItem(COUNTED_FLAG) === '1';
    const endpoint = alreadyCounted
      ? '/api/visits?mode=peek'
      : '/api/visits';

    fetch(endpoint, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as {
          counted?: boolean;
          total?: number | null;
        };
        if (typeof data?.total !== 'number') {
          throw new Error('bad payload');
        }
        if (!cancelled) {
          setTotal(data.total);
          if (data.counted) {
            sessionStorage.setItem(COUNTED_FLAG, '1');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-1.5"
      role="status"
      aria-label="عدد زوار المنصة"
    >
      <span className="text-[10px] leading-none text-sky-300/80 font-medium">
        زائر
      </span>
      <span
        dir="ltr"
        className="inline-flex items-center rounded-md border border-cyan-400/40 bg-[#020617] px-2 py-[3px] font-mono text-[11px] leading-none font-bold tracking-[0.18em] text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.35),inset_0_0_8px_rgba(34,211,238,0.15)]"
      >
        {total === null ? '—' : total.toLocaleString('en-US')}
      </span>
    </div>
  );
}
