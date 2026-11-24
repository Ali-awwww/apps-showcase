import { GITHUB_OWNER } from '../data/apps';
import {
  AppDefinition,
  GitHubReleaseRaw,
  ParsedRelease,
  ReleasesMap,
  RepoReleaseState,
} from '../types/app';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function formatArabicDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function isWithinLastSevenDays(isoDate: string): boolean {
  const publishedMs = new Date(isoDate).getTime();
  if (Number.isNaN(publishedMs)) {
    return false;
  }

  const diff = Date.now() - publishedMs;
  return diff >= -86_400_000 && diff <= SEVEN_DAYS_MS;
}

export function formatFileSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) {
    return null;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  return `${Math.round(kb)} KB`;
}

function parseReleasePayload(raw: GitHubReleaseRaw): ParsedRelease {
  const assets = Array.isArray(raw.assets) ? raw.assets : [];
  const apkAsset =
    assets.find(
      (asset) =>
        typeof asset.name === 'string' &&
        asset.name.toLowerCase().endsWith('.apk') &&
        typeof asset.browser_download_url === 'string'
    ) ?? null;

  return {
    tagName: raw.tag_name || '',
    publishedAt: raw.published_at || '',
    formattedDate: raw.published_at ? formatArabicDate(raw.published_at) : '',
    body: typeof raw.body === 'string' ? raw.body.trim() : '',
    htmlUrl: raw.html_url || '',
    apkUrl: apkAsset ? apkAsset.browser_download_url : null,
    apkName: apkAsset ? apkAsset.name : null,
    apkSizeBytes: apkAsset && typeof apkAsset.size === 'number' ? apkAsset.size : null,
    isNew: raw.published_at ? isWithinLastSevenDays(raw.published_at) : false,
  };
}

export async function fetchRepoLatestRelease(
  repo: string,
  signal?: AbortSignal
): Promise<RepoReleaseState> {
  const endpoint = `https://api.github.com/repos/${GITHUB_OWNER}/${encodeURIComponent(
    repo
  )}/releases/latest`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal,
    });

    if (response.status === 404) {
      return {
        status: 'not_found',
        release: null,
        errorReason: null,
        errorMessage: null,
      };
    }

    if (response.status === 403 || response.status === 429) {
      return {
        status: 'error',
        release: null,
        errorReason: 'rate_limit',
        errorMessage:
          'تم تجاوز حد الطلبات المسموح به من GitHub API مؤقتاً. يرجى المحاولة بعد قليل.',
      };
    }

    if (!response.ok) {
      return {
        status: 'error',
        release: null,
        errorReason: 'unknown',
        errorMessage: `تعذر جلب بيانات الإصدار من GitHub (رمز الاستجابة: ${response.status}).`,
      };
    }

    const data = (await response.json()) as GitHubReleaseRaw;
    return {
      status: 'ready',
      release: parseReleasePayload(data),
      errorReason: null,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return {
      status: 'error',
      release: null,
      errorReason: 'network',
      errorMessage:
        'تعذر الاتصال بـ GitHub. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
    };
  }
}

export function createInitialLoadingState(apps: AppDefinition[]): ReleasesMap {
  const map: ReleasesMap = {};
  for (const app of apps) {
    map[app.repo] = {
      status: 'loading',
      release: null,
      errorReason: null,
      errorMessage: null,
    };
  }
  return map;
}

export async function fetchAllRepoReleases(
  apps: AppDefinition[],
  signal?: AbortSignal
): Promise<ReleasesMap> {
  const entries = await Promise.all(
    apps.map(async (app) => {
      const state = await fetchRepoLatestRelease(app.repo, signal);
      return [app.repo, state] as const;
    })
  );

  return Object.fromEntries(entries);
}
