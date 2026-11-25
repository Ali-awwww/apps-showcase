// GET /api/visits — total site visits counter backed by Cloudflare KV.
//
// Binding: VISITS_KV (KV namespace "apps-showcase-visits", bound to the
// Pages project for production and preview).
// - GET /api/visits            → increments the total by 1 and returns it.
// - GET /api/visits?mode=peek → returns the current total without counting.
// If the KV binding is missing (e.g. local dev or the static GitHub Pages
// copy, which has no Functions), it answers 503 with counted:false so the
// UI hides the counter instead of showing an error.
//
// Note: Workers KV has no native atomic increment, so this is a read-then-
// write. The frontend only calls the incrementing endpoint once per browser
// session (sessionStorage guard), so concurrent double-counting is minimal.

const COUNTER_KEY = 'total_visits';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestGet(context: any): Promise<Response> {
  const kv = context?.env?.VISITS_KV as
    | {
        get(key: string): Promise<string | null>;
        put(key: string, value: string): Promise<void>;
      }
    | undefined;

  if (!kv) {
    return jsonResponse({ counted: false, total: null }, 503);
  }

  const url = new URL(context.request.url);
  const peekOnly = url.searchParams.get('mode') === 'peek';

  try {
    const stored = await kv.get(COUNTER_KEY);
    let total = stored ? parseInt(stored, 10) : 0;
    if (!Number.isFinite(total) || total < 0) {
      total = 0;
    }

    if (!peekOnly) {
      total += 1;
      await kv.put(COUNTER_KEY, String(total));
    }

    return jsonResponse({ counted: !peekOnly, total }, 200);
  } catch (err) {
    console.error('[Visits] KV error:', err);
    return jsonResponse({ counted: false, total: null }, 503);
  }
}
