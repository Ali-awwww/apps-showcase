import { APPS_CATALOG } from '../data/apps';
import {
  AppDefinition,
  ParsedRelease,
  ReleaseLoadStatus,
  ReleasesMap,
  RepoReleaseState,
} from '../types/app';
import { formatArabicDate, isWithinLastSevenDays } from './github';

// Server-side latest data (GET /api/latest) — the same source of truth the
// assistant uses, so the "ما الجديد" page and the assistant never disagree.
// On the static GitHub Pages copy there is no Functions endpoint, so any
// failure returns null and the caller keeps the client-side GitHub data.

export interface ServerLatestApp {
  repo: string;
  name: string;
  category: string;
  hasRelease: boolean;
  tag: string | null;
  publishedAt: string | null;
  damascus: string | null;
  damascusDate: string | null;
  relative: string | null;
  apkUrl: string | null;
  apkName: string | null;
  apkSizeBytes: number | null;
  htmlUrl: string | null;
  body: string | null;
  isNew: boolean;
}

export interface ServerLatestResponse {
  ok: boolean;
  source: 'live' | 'cache' | 'stale-cache' | 'empty';
  fetchedAt: string;
  ageText: string;
  githubAuthenticated: boolean;
  partialFailure: boolean;
  latest: ServerLatestApp | null;
  apps: ServerLatestApp[];
}

export async function fetchServerLatest(
  signal?: AbortSignal
): Promise<ServerLatestResponse | null> {
  try {
    const response = await fetch('/api/latest', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as Partial<ServerLatestResponse>;
    if (!data || data.ok !== true || !Array.isArray(data.apps)) {
      return null;
    }
    return data as ServerLatestResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return null;
  }
}

// Merge server data into the client-side releases map. A server entry with
// a release always wins (same data the assistant answers from); a server
// entry without a release keeps the client-side entry when the client
// already has one, so one failed repo fetch never hides a published release.
export function mergeServerLatestIntoReleases(
  clientReleases: ReleasesMap,
  server: ServerLatestResponse
): ReleasesMap {
  const merged: ReleasesMap = { ...clientReleases };
  const byRepo = new Map(server.apps.map((app) => [app.repo, app]));

  for (const app of APPS_CATALOG) {
    const item = byRepo.get(app.repo);
    if (!item) {
      continue;
    }
    if (item.hasRelease && item.tag && item.publishedAt) {
      const release: ParsedRelease = {
        tagName: item.tag,
        publishedAt: item.publishedAt,
        formattedDate:
          item.damascusDate ?? formatArabicDate(item.publishedAt),
        body: item.body ?? '',
        htmlUrl: item.htmlUrl ?? '',
        apkUrl: item.apkUrl,
        apkName: item.apkName,
        apkSizeBytes: item.apkSizeBytes,
        isNew: item.isNew ?? isWithinLastSevenDays(item.publishedAt),
      };
      const state: RepoReleaseState = {
        status: 'ready',
        release,
        errorReason: null,
        errorMessage: null,
      };
      merged[app.repo] = state;
    } else if (
      merged[app.repo]?.status !== 'ready' &&
      merged[app.repo]?.status !== 'loading'
    ) {
      merged[app.repo] = {
        status: 'not_found',
        release: null,
        errorReason: null,
        errorMessage: null,
      };
    }
  }

  return merged;
}

export type { AppDefinition, ReleaseLoadStatus };
