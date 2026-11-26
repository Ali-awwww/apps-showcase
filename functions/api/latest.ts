// GET /api/latest — latest release of each of the 8 apps, computed
// server-side (fetched from GitHub, sorted newest first, times in
// Asia/Damascus). This is the single source of truth shared by the
// "ما الجديد" page and the assistant (functions/api/chat.ts), so the page
// and the assistant can never disagree.
//
// Response: { ok, source, fetchedAt, ageText,
//   partialFailure, latest, apps: [...] }
// (githubAuthenticated is deliberately NOT exposed: it only says whether
// the server holds a token — an operational detail with no public use.)
// Cached in KV for 5 minutes (see functions/api/_lib/latest.ts); the
// endpoint itself is public and needs no quota. If GitHub cannot be
// reached at all it still answers 200 with hasRelease:false items.

import { getLatestReleases } from './_lib/latest';

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

export async function onRequestGet(context: any): Promise<Response> {
  try {
    const snapshot = await getLatestReleases(context?.env);
    return jsonResponse(
      {
        ok: true,
        source: snapshot.source,
        fetchedAt: snapshot.fetchedAt,
        ageText: snapshot.ageText,
        partialFailure: snapshot.partialFailure,
        latest: snapshot.latest,
        apps: snapshot.items,
      },
      200
    );
  } catch (err) {
    console.error('[Latest] Unexpected error:', err);
    return jsonResponse(
      { ok: false, error: 'تعذّر جلب أحدث الإصدارات حالياً.' },
      502
    );
  }
}
