// GET /api/visits — total site visits counter backed by Cloudflare KV.
//
// Binding: VISITS_KV (KV namespace "apps-showcase-visits", bound to the
// Pages project for production and preview).
//
// Protected against inflation: the counter only increments when the caller
// presents a one-time token issued by this same endpoint. A plain GET can
// no longer inflate the counter (previously any `GET /api/visits` added 1).
// - GET /api/visits?mode=peek  → returns the current total without counting.
// - GET /api/visits?mode=token → issues a one-time token (max 5 per IP/day).
// - GET /api/visits?token=...  → consumes the token and increments once;
//   a missing/expired/already-used token is rejected (counted:false).
// - GET /api/visits (anything else) → peek behaviour, never counts.
// Tokens live 10 minutes and are deleted on use, so a replayed token is
// rejected. If the KV binding is missing (e.g. local dev or the static
// GitHub Pages copy, which has no Functions), it answers 503 with
// counted:false so the UI hides the counter instead of showing an error.
//
// Note: Workers KV has no native atomic increment, so this is a read-then-
// write. The frontend only counts once per browser session (sessionStorage
// guard + one token), so concurrent double-counting is minimal.

const COUNTER_KEY = 'total_visits';
const TOKEN_TTL_SECONDS = 10 * 60;
const TOKEN_ISSUE_TTL_SECONDS = 24 * 60 * 60;
const MAX_TOKENS_PER_IP_PER_DAY = 5;

type KvStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': 'https://apps-showcase.pages.dev',
    },
  });
}

function getClientIp(request: Request | undefined): string {
  const headers = request?.headers;
  if (!headers) {
    return '';
  }
  const direct = (headers.get('cf-connecting-ip') || '').trim();
  if (direct) {
    return direct;
  }
  const forwarded = (headers.get('x-forwarded-for') || '').trim();
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? '';
  }
  return '';
}

function normalizeClientIp(ip: string): string {
  const trimmed = ip.trim();
  if (!trimmed.includes(':')) {
    return trimmed; // IPv4: count per address.
  }
  // IPv6: count per /64 network prefix (first 4 groups).
  const head = trimmed.split('::')[0] ?? '';
  const groups = head.split(':').filter((g) => g.length > 0);
  if (groups.length >= 4) {
    return `${groups.slice(0, 4).join(':')}::/64`;
  }
  return trimmed;
}

function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `v1-${hex}`;
}

export async function onRequestGet(context: any): Promise<Response> {
  const kv = context?.env?.VISITS_KV as KvStore | undefined;

  if (!kv) {
    return jsonResponse({ counted: false, total: null }, 503);
  }

  const url = new URL(context.request.url);
  const mode = url.searchParams.get('mode');
  const presentedToken = url.searchParams.get('token');

  try {
    const stored = await kv.get(COUNTER_KEY);
    let total = stored ? parseInt(stored, 10) : 0;
    if (!Number.isFinite(total) || total < 0) {
      total = 0;
    }

    // Peek: read-only, never counts.
    if (mode === 'peek' || (!mode && !presentedToken)) {
      return jsonResponse({ counted: false, total }, 200);
    }

    // Issue a one-time token (rate-limited per IP so tokens cannot be
    // mass-minted to inflate the counter from one address).
    if (mode === 'token') {
      const ip = normalizeClientIp(getClientIp(context.request));
      if (!ip) {
        return jsonResponse(
          { counted: false, total, error: 'تعذّر التحقق من الزيارة.' },
          400
        );
      }
      const today = new Date().toISOString().slice(0, 10);
      const issueKey = `visit-token-issue:${ip}:${today}`;
      const issuedRaw = await kv.get(issueKey);
      const issued = issuedRaw ? parseInt(issuedRaw, 10) || 0 : 0;
      if (issued >= MAX_TOKENS_PER_IP_PER_DAY) {
        return jsonResponse(
          { counted: false, total, error: 'تم تجاوز حد إصدار الرموز اليوم.' },
          429
        );
      }
      const token = newToken();
      await kv.put(`visit-token:${token}`, '1', {
        expirationTtl: TOKEN_TTL_SECONDS,
      });
      await kv.put(issueKey, String(issued + 1), {
        expirationTtl: TOKEN_ISSUE_TTL_SECONDS,
      });
      return jsonResponse({ counted: false, total, token }, 200);
    }

    // Consume a token: increment exactly once, then the token is gone.
    if (presentedToken) {
      const tokenKey = `visit-token:${presentedToken}`;
      const valid = await kv.get(tokenKey);
      if (!valid) {
        return jsonResponse(
          { counted: false, total, error: 'الرمز غير صالح أو مستخدم من قبل.' },
          200
        );
      }
      await kv.delete(tokenKey);
      total += 1;
      await kv.put(COUNTER_KEY, String(total));
      return jsonResponse({ counted: true, total }, 200);
    }

    return jsonResponse({ counted: false, total }, 200);
  } catch (err) {
    console.error('[Visits] KV error:', err);
    return jsonResponse({ counted: false, total: null }, 503);
  }
}
