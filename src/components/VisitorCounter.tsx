import { useEffect, useState } from 'react';

// Modern digital/LED-style total-visits counter, shown under the platform
// name in the header. The count lives in Cloudflare KV and is served by the
// Pages Function GET /api/visits. Counting is protected by a one-time
// server token: the page first asks for a token (?mode=token), then spends
// it once (?token=...). A token cannot be replayed, and the counter is
// incremented at most once per browser session (sessionStorage guard).
// If the endpoint is unavailable (e.g. the static GitHub Pages copy, which
// has no Functions), the counter simply renders nothing — never an error.
const COUNTED_FLAG = 'muadh-visits-counted';

interface VisitsPayload {
  counted?: boolean;
  total?: number | null;
  token?: string;
}

async function fetchVisitsJson(
  endpoint: string
): Promise<VisitsPayload | null> {
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as VisitsPayload;
  if (typeof data?.total !== 'number') {
    throw new Error('bad payload');
  }
  return data;
}

export function VisitorCounter() {
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const alreadyCounted =
          sessionStorage.getItem(COUNTED_FLAG) === '1';

        // Already counted this session: read-only peek.
        if (alreadyCounted) {
          const data = await fetchVisitsJson('/api/visits?mode=peek');
          if (!cancelled && data) {
            setTotal(data.total ?? null);
          }
          return;
        }

        // New session: get a one-time token, then spend it to count once.
        try {
          const tokenData = await fetchVisitsJson('/api/visits?mode=token');
          if (tokenData?.token) {
            const counted = await fetchVisitsJson(
              `/api/visits?token=${encodeURIComponent(tokenData.token)}`
            );
            if (!cancelled && counted) {
              setTotal(counted.total ?? null);
              if (counted.counted) {
                sessionStorage.setItem(COUNTED_FLAG, '1');
              }
              return;
            }
          }
        } catch {
          // Token flow failed (e.g. per-IP token limit): fall through to
          // a read-only peek so the counter still shows, uncounted.
        }

        const peek = await fetchVisitsJson('/api/visits?mode=peek');
        if (!cancelled && peek) {
          setTotal(peek.total ?? null);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    };

    void load();

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
