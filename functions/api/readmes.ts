// GET /api/readmes — README.md of each of the 8 apps, fetched server-side
// (authenticated GitHub token + 5-minute KV cache) so the browser no longer
// spends up to 16+ unauthenticated GitHub API calls per visit.
// Response: { ok, source, apps: [{ repo, status, markdown, htmlUrl }] }
// where status is 'ready' | 'not_found' | 'error'.
// The frontend parses the markdown with the same parser it used client-side;
// on any failure it falls back to the direct GitHub fetch.

import { APPS, GITHUB_OWNER } from './_lib/latest';

// Bump the cache key when the fetch logic changes: v1 entries were
// poisoned by the missing-User-Agent bug (all 'error').
const READMES_CACHE_KEY = 'readmes:v2';
const READMES_CACHE_TTL_SECONDS = 5 * 60;
const FETCH_TIMEOUT_MS = 10000;

export interface ServerReadmeItem {
  repo: string;
  status: 'ready' | 'not_found' | 'error';
  markdown: string | null;
  htmlUrl: string | null;
}

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

function blobUrl(repo: string, branch = 'HEAD'): string {
  return `https://github.com/${GITHUB_OWNER}/${encodeURIComponent(repo)}/blob/${branch}/README.md`;
}

async function fetchRawText(
  url: string,
  token: string
): Promise<{ status: number; text: string | null }> {
  try {
    const headers: Record<string, string> = {
      // GitHub rejects API requests without a User-Agent header (403).
      'User-Agent': 'apps-showcase',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return { status: 404, text: null };
    }
    if (!response.ok) {
      return { status: response.status, text: null };
    }
    return { status: 200, text: await response.text() };
  } catch {
    return { status: 0, text: null };
  }
}

async function fetchOneReadme(
  repo: string,
  token: string
): Promise<ServerReadmeItem> {
  const notFound: ServerReadmeItem = {
    repo,
    status: 'not_found',
    markdown: null,
    htmlUrl: null,
  };

  // Primary: GitHub API /readme with raw accept (authenticated when the
  // GITHUB_TOKEN secret is set, so it does not burn the visitor's 60/hr).
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw',
      // GitHub rejects API requests without a User-Agent header (403).
      'User-Agent': 'apps-showcase',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${encodeURIComponent(repo)}/readme`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    if (response.status === 404) {
      return notFound;
    }
    if (response.ok) {
      const markdown = await response.text();
      if (markdown.trim()) {
        return { repo, status: 'ready', markdown, htmlUrl: blobUrl(repo) };
      }
      return notFound;
    }
    // Any other API failure (403/429 rate limit, 5xx): fall through to
    // the raw.githubusercontent.com mirrors below instead of giving up.
  } catch {
    // Fall through to the raw.githubusercontent.com mirrors below.
  }

  // Fallbacks: raw.githubusercontent.com, main then master.
  let saw404 = 0;
  for (const branch of ['main', 'master'] as const) {
    const raw = await fetchRawText(
      `https://raw.githubusercontent.com/${GITHUB_OWNER}/${encodeURIComponent(repo)}/${branch}/README.md`,
      ''
    );
    if (raw.status === 404) {
      saw404 += 1;
      continue;
    }
    if (raw.status === 200 && raw.text && raw.text.trim()) {
      return {
        repo,
        status: 'ready',
        markdown: raw.text,
        htmlUrl: blobUrl(repo, branch),
      };
    }
  }
  if (saw404 === 2) {
    return notFound;
  }
  return { repo, status: 'error', markdown: null, htmlUrl: null };
}

export async function onRequestGet(context: any): Promise<Response> {
  const kv = context?.env?.VISITS_KV as
    | {
        get(key: string): Promise<string | null>;
        put(key: string, value: string, opts?: any): Promise<void>;
      }
    | undefined;
  const token =
    typeof context?.env?.GITHUB_TOKEN === 'string'
      ? context.env.GITHUB_TOKEN.trim()
      : '';

  // 1) Fresh KV cache (5 minutes).
  if (kv && typeof kv.get === 'function') {
    try {
      const cachedRaw = await kv.get(READMES_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          fetchedAt: number;
          apps: ServerReadmeItem[];
        };
        if (
          cached &&
          Array.isArray(cached.apps) &&
          typeof cached.fetchedAt === 'number' &&
          Date.now() - cached.fetchedAt < READMES_CACHE_TTL_SECONDS * 1000
        ) {
          return jsonResponse({ ok: true, source: 'cache', apps: cached.apps });
        }
      }
    } catch {
      // Ignore cache read errors and fetch live.
    }
  }

  // 2) Live fetch from GitHub (authenticated when GITHUB_TOKEN is set).
  const fetchedAtMs = Date.now();
  const settled = await Promise.allSettled(
    APPS.map((app) => fetchOneReadme(app.repo, token))
  );
  const apps = settled.map((r, idx) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          repo: APPS[idx].repo,
          status: 'error' as const,
          markdown: null,
          htmlUrl: null,
        }
  );

  // 3) Store in KV for the next 5 minutes (fail-open on KV errors).
  if (kv && typeof kv.put === 'function') {
    try {
      await kv.put(
        READMES_CACHE_KEY,
        JSON.stringify({ fetchedAt: fetchedAtMs, apps }),
        { expirationTtl: READMES_CACHE_TTL_SECONDS }
      );
    } catch {
      // Ignore KV write errors.
    }
  }

  return jsonResponse({ ok: true, source: 'live', apps });
}
