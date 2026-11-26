// Shared "latest releases" helper — the single source of truth for both
// GET /api/latest (used by the "ما الجديد" page) and the chat function
// (functions/api/chat.ts). The server fetches, sorts and formats everything
// here, so the model never has to sort dates or convert timezones itself,
// and the page and the assistant can never disagree.
//
// GitHub fetch is authenticated when the GITHUB_TOKEN secret is set
// (read-only token, public repos only); without it, it falls back to the
// unauthenticated API (60 requests/hour) and to the KV cache.
// Results are cached in the VISITS_KV namespace for 5 minutes.

export const GITHUB_OWNER = 'Ali-awwww';

export const APPS: Array<{ repo: string; name: string; category: string }> = [
  { repo: 'muslim-assistant', name: 'مساعد المسلم', category: 'إسلامي' },
  { repo: 'phone-agent', name: 'وكيل الهاتف', category: 'أدوات' },
  { repo: 'abu-jrin-market', name: 'سوق قرية أبو جرين', category: 'تسوق' },
  { repo: '-Vibe-coding', name: 'فيب كودينغ', category: 'تطوير' },
  { repo: '-AW', name: 'AW', category: 'أدوات' },
  { repo: 'adhan-reminder', name: 'مذكر الأذان', category: 'إسلامي' },
  { repo: 'sadiq-al-muslim', name: 'صديق المسلم', category: 'إسلامي' },
  { repo: 'sibaq-al-maalumat', name: 'سباق المعلومات', category: 'إسلامي' },
];

export interface LatestReleaseItem {
  repo: string;
  name: string;
  category: string;
  hasRelease: boolean;
  tag: string | null;
  publishedAt: string | null; // ISO 8601 from GitHub
  damascus: string | null; // e.g. "25 نوفمبر 2026، 1:22 م" (date + time, Asia/Damascus)
  damascusDate: string | null; // e.g. "25 نوفمبر 2026"
  relative: string | null; // e.g. "منذ ساعتين"
  apkUrl: string | null;
  apkName: string | null;
  apkSizeBytes: number | null;
  htmlUrl: string | null;
  body: string | null;
  isNew: boolean;
}

export interface LatestSnapshot {
  items: LatestReleaseItem[]; // sorted newest first; apps without a release last
  latest: LatestReleaseItem | null;
  fetchedAt: string; // ISO 8601
  ageSeconds: number;
  ageText: string; // e.g. "البيانات محدثة قبل دقيقتين"
  source: 'live' | 'cache' | 'stale-cache' | 'empty';
  githubAuthenticated: boolean;
  partialFailure: boolean; // true if at least one repo could not be fetched
}

const LATEST_CACHE_KEY = 'latest:releases:v1';
const LATEST_CACHE_TTL_SECONDS = 5 * 60;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const damascusDateFmt = new Intl.DateTimeFormat('ar-u-nu-latn', {
  timeZone: 'Asia/Damascus',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const damascusTimeFmt = new Intl.DateTimeFormat('ar-u-nu-latn', {
  timeZone: 'Asia/Damascus',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatDamascus(iso: string): { damascus: string; damascusDate: string } {
  const date = new Date(iso);
  const damascusDate = damascusDateFmt.format(date);
  const damascus = `${damascusDate}، ${damascusTimeFmt.format(date)}`;
  return { damascus, damascusDate };
}

function pluralForm(
  n: number,
  one: string,
  two: string,
  few: string,
  many: string
): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

// Arabic "ago" text, e.g. "منذ ساعتين" / "قبل دقيقتين".
export function formatAgo(ms: number, prefix: 'منذ' | 'قبل'): string {
  if (ms < 45 * 1000) {
    return prefix === 'منذ' ? 'الآن' : 'الآن';
  }
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) {
    return `${prefix} ${pluralForm(minutes, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${prefix} ${pluralForm(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${prefix} ${pluralForm(days, 'يوم', 'يومين', 'أيام', 'يوماً')}`;
  }
  const weeks = Math.floor(days / 7);
  return `${prefix} ${pluralForm(weeks, 'أسبوع', 'أسبوعين', 'أسابيع', 'أسبوعاً')}`;
}

function isWithinLastSevenDays(iso: string): boolean {
  const publishedMs = new Date(iso).getTime();
  if (Number.isNaN(publishedMs)) return false;
  const diff = Date.now() - publishedMs;
  return diff >= -86_400_000 && diff <= SEVEN_DAYS_MS;
}

interface GitHubReleaseRaw {
  tag_name?: string;
  published_at?: string;
  body?: string | null;
  html_url?: string;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
    size?: number;
  }>;
}

async function fetchOneRelease(
  repo: string,
  token: string
): Promise<LatestReleaseItem> {
  const meta = APPS.find((a) => a.repo === repo) ?? {
    repo,
    name: repo,
    category: '',
  };
  const empty: LatestReleaseItem = {
    repo,
    name: meta.name,
    category: meta.category,
    hasRelease: false,
    tag: null,
    publishedAt: null,
    damascus: null,
    damascusDate: null,
    relative: null,
    apkUrl: null,
    apkName: null,
    apkSizeBytes: null,
    htmlUrl: null,
    body: null,
    isNew: false,
  };

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'apps-showcase',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${encodeURIComponent(repo)}/releases/latest`,
      { headers, signal: AbortSignal.timeout(15000) }
    );
    if (!response.ok) {
      // 404 = no release published yet; 403/429 = rate limit; anything else
      // is treated the same way: no release data for this repo right now.
      return empty;
    }
    const raw = (await response.json()) as GitHubReleaseRaw;
    const publishedAt =
      typeof raw.published_at === 'string' ? raw.published_at : '';
    if (!raw.tag_name || !publishedAt) {
      return empty;
    }
    const assets = Array.isArray(raw.assets) ? raw.assets : [];
    const apk =
      assets.find(
        (a) =>
          typeof a.name === 'string' &&
          a.name.toLowerCase().endsWith('.apk') &&
          typeof a.browser_download_url === 'string'
      ) ?? null;
    const { damascus, damascusDate } = formatDamascus(publishedAt);
    return {
      ...empty,
      hasRelease: true,
      tag: raw.tag_name,
      publishedAt,
      damascus,
      damascusDate,
      relative: formatAgo(Date.now() - new Date(publishedAt).getTime(), 'منذ'),
      apkUrl: apk?.browser_download_url ?? null,
      apkName: apk?.name ?? null,
      apkSizeBytes: typeof apk?.size === 'number' ? apk.size : null,
      htmlUrl: typeof raw.html_url === 'string' ? raw.html_url : null,
      body:
        typeof raw.body === 'string' ? raw.body.trim().slice(0, 1500) : null,
      isNew: isWithinLastSevenDays(publishedAt),
    };
  } catch {
    return empty;
  }
}

function sortItems(items: LatestReleaseItem[]): LatestReleaseItem[] {
  return [...items].sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
}

function buildSnapshot(
  items: LatestReleaseItem[],
  fetchedAtMs: number,
  source: LatestSnapshot['source'],
  githubAuthenticated: boolean,
  partialFailure: boolean
): LatestSnapshot {
  const sorted = sortItems(items);
  const ageSeconds = Math.max(0, Math.floor((Date.now() - fetchedAtMs) / 1000));
  const ageText =
    ageSeconds < 45
      ? 'البيانات محدثة الآن'
      : `البيانات محدثة ${formatAgo(ageSeconds * 1000, 'قبل')}`;
  return {
    items: sorted,
    latest: sorted.find((i) => i.hasRelease) ?? null,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    ageSeconds,
    ageText,
    source,
    githubAuthenticated,
    partialFailure,
  };
}

// Fetch (or read from the 5-minute KV cache) the latest release of each app.
// Never throws: on total failure it returns an "empty" snapshot whose items
// all report hasRelease:false, so callers can fall back gracefully.
export async function getLatestReleases(env: any): Promise<LatestSnapshot> {
  const kv = env?.VISITS_KV as
    | {
        get(key: string): Promise<string | null>;
        put(key: string, value: string, opts?: any): Promise<void>;
      }
    | undefined;
  const token =
    typeof env?.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';
  const githubAuthenticated = Boolean(token);

  // 1) Fresh KV cache (5 minutes).
  if (kv && typeof kv.get === 'function') {
    try {
      const cachedRaw = await kv.get(LATEST_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          fetchedAt: number;
          items: LatestReleaseItem[];
          githubAuthenticated: boolean;
          partialFailure: boolean;
        };
        if (
          cached &&
          Array.isArray(cached.items) &&
          typeof cached.fetchedAt === 'number' &&
          Date.now() - cached.fetchedAt < LATEST_CACHE_TTL_SECONDS * 1000
        ) {
          return buildSnapshot(
            cached.items,
            cached.fetchedAt,
            'cache',
            cached.githubAuthenticated,
            cached.partialFailure
          );
        }
      }
    } catch {
      // Ignore cache read errors and fetch live.
    }
  }

  // 2) Live fetch from GitHub (authenticated when GITHUB_TOKEN is set).
  const fetchedAtMs = Date.now();
  const settled = await Promise.allSettled(
    APPS.map((app) => fetchOneRelease(app.repo, token))
  );
  const items = settled.map((r, idx) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          repo: APPS[idx].repo,
          name: APPS[idx].name,
          category: APPS[idx].category,
          hasRelease: false,
          tag: null,
          publishedAt: null,
          damascus: null,
          damascusDate: null,
          relative: null,
          apkUrl: null,
          apkName: null,
          apkSizeBytes: null,
          htmlUrl: null,
          body: null,
          isNew: false,
        }
  );
  // A repo that reports no release may genuinely have none (404) or the
  // fetch may have failed; treat "no release data at all" as a failure
  // only when the live fetch produced nothing for every app.
  const anyRelease = items.some((i) => i.hasRelease);
  const partialFailure = items.some((i) => !i.hasRelease);

  if (anyRelease) {
    // 3) Store in KV for the next 5 minutes (fail-open on KV errors).
    if (kv && typeof kv.put === 'function') {
      try {
        await kv.put(
          LATEST_CACHE_KEY,
          JSON.stringify({
            fetchedAt: fetchedAtMs,
            items,
            githubAuthenticated,
            partialFailure,
          }),
          { expirationTtl: LATEST_CACHE_TTL_SECONDS }
        );
      } catch {
        // Ignore KV write errors.
      }
    }
    return buildSnapshot(items, fetchedAtMs, 'live', githubAuthenticated, partialFailure);
  }

  // 4) Total failure: fall back to any stale cache, however old.
  if (kv && typeof kv.get === 'function') {
    try {
      const cachedRaw = await kv.get(LATEST_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          fetchedAt: number;
          items: LatestReleaseItem[];
          githubAuthenticated: boolean;
          partialFailure: boolean;
        };
        if (cached && Array.isArray(cached.items)) {
          return buildSnapshot(
            cached.items,
            cached.fetchedAt,
            'stale-cache',
            cached.githubAuthenticated,
            true
          );
        }
      }
    } catch {
      // Ignore cache read errors.
    }
  }

  return buildSnapshot(items, fetchedAtMs, 'empty', githubAuthenticated, true);
}

// Ready-made facts block (Arabic, server-computed). The model must copy the
// order and the times from here verbatim — never re-sort or convert.
export function buildLatestFactsBlock(snapshot: LatestSnapshot): string {
  const lines: string[] = [];
  const { latest } = snapshot;

  if (latest) {
    lines.push(
      `أحدث إصدار: ${latest.name} ${latest.tag} — ${latest.damascus} بتوقيت دمشق (${latest.relative}).`
    );
  } else {
    lines.push('أحدث إصدار: لا يوجد إصدار منشور بعد لأي تطبيق.');
  }

  lines.push('ترتيب الإصدارات من الأحدث إلى الأقدم (جميع الأوقات بتوقيت دمشق +03):');
  snapshot.items.forEach((item, idx) => {
    if (item.hasRelease) {
      lines.push(
        `${idx + 1}. ${item.name} — ${item.tag} — ${item.damascus} (${item.relative})${item.isNew ? ' — جديد' : ''}`
      );
    }
  });

  const noRelease = snapshot.items.filter((i) => !i.hasRelease);
  if (noRelease.length > 0) {
    lines.push(
      `تطبيقات ليس لها إصدار منشور بعد: ${noRelease.map((i) => i.name).join('، ')}.`
    );
  }
  if (snapshot.partialFailure) {
    lines.push(
      'ملاحظة: تعذّر جلب بيانات بعض الإصدارات من GitHub في هذه اللحظة، فاعتمد فقط على ما هو مذكور أعلاه ولا تخمّن ما ينقص.'
    );
  }
  lines.push(`${snapshot.ageText}.`);
  return lines.join('\n');
}

// Compact JSON table of the releases (structured data, not prose).
export function buildLatestJsonTable(snapshot: LatestSnapshot): string {
  const rows = snapshot.items.map((item, idx) => ({
    الترتيب: idx + 1,
    التطبيق: item.name,
    المستودع: item.repo,
    التصنيف: item.category,
    الإصدار: item.hasRelease ? item.tag : 'قريباً (لا يوجد إصدار)',
    'تاريخ النشر بتوقيت دمشق': item.damascus ?? '—',
    منذ: item.relative ?? '—',
    جديد: item.isNew,
    'رابط APK': item.apkUrl ?? 'غير مرفق',
  }));
  return JSON.stringify(rows);
}
