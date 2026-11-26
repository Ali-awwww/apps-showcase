import { GITHUB_OWNER } from '../data/apps';
import {
  AppDefinition,
  ParsedReadme,
  ReadmesMap,
  ReleaseErrorReason,
  RepoReadmeState,
} from '../types/app';

const FEATURES_HEADING_KEYWORDS = [
  'مزايا',
  'ميزات',
  'الميزات',
  'المميزات',
  'features',
  'feature',
  'ماذا يفعل',
];

const INSTALL_USAGE_HEADING_KEYWORDS = [
  'التثبيت والاستخدام',
  'تثبيت',
  'installation',
  'install',
  'الاستخدام',
  'استخدام',
  'usage',
  'تشغيل',
  'البدء',
];

function headingMatchesKeywords(heading: string, keywords: string[]): boolean {
  const normalized = heading.toLowerCase();
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()));
}

function stripInlineMarkdown(text: string): string {
  return text
    // Remove markdown images/badges [![alt](img)](link) or ![alt](img)
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // Convert markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Strip simple HTML tags if any
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadgeOrImageOnlyLine(trimmed: string): boolean {
  if (!trimmed) return false;
  // Pure markdown image or badge link
  const withoutBadges = trimmed
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<\/?(a|p|div|span|center|br)\b[^>]*>/gi, '')
    .trim();
  return withoutBadges.length === 0;
}

function isIgnorableNonProseLine(trimmed: string): boolean {
  if (!trimmed) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^[-*_]{3,}$/.test(trimmed)) return true;
  if (/^<!--[\s\S]*-->$/.test(trimmed)) return true;
  if (/^<!--/.test(trimmed)) return true;
  if (isBadgeOrImageOnlyLine(trimmed)) return true;
  return false;
}

function truncateText(text: string, maxLength = 175): string {
  if (text.length <= maxLength) {
    return text;
  }
  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trim()}...`;
}

export function parseReadmeMarkdown(
  rawMarkdown: string,
  htmlUrl: string
): ParsedReadme {
  const lines = rawMarkdown.split(/\r?\n/);

  // 1. Extract first meaningful paragraph after a heading (or start of file)
  let description: string | null = null;
  let inCodeBlock = false;
  let inHtmlComment = false;
  let seenFirstHeading = false;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0 || description !== null) {
      paragraphLines = [];
      return;
    }
    const cleaned = stripInlineMarkdown(paragraphLines.join(' '));
    paragraphLines = [];
    if (cleaned.length > 0) {
      description = cleaned;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      flushParagraph();
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (trimmed.includes('<!--')) {
      if (!trimmed.includes('-->')) {
        inHtmlComment = true;
      }
      continue;
    }
    if (inHtmlComment) {
      if (trimmed.includes('-->')) {
        inHtmlComment = false;
      }
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      if (paragraphLines.length > 0) {
        flushParagraph();
        if (description) break;
      }
      seenFirstHeading = true;
      continue;
    }

    if (!seenFirstHeading && isBadgeOrImageOnlyLine(trimmed)) {
      continue;
    }

    if (!trimmed) {
      if (paragraphLines.length > 0) {
        flushParagraph();
        if (description) break;
      }
      continue;
    }

    if (isIgnorableNonProseLine(trimmed)) {
      if (paragraphLines.length > 0) {
        flushParagraph();
        if (description) break;
      }
      continue;
    }

    // Skip list items if we haven't started a paragraph yet
    if (
      paragraphLines.length === 0 &&
      (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed))
    ) {
      continue;
    }

    const proseLine = trimmed.replace(/^>\s*/, '');
    if (!isBadgeOrImageOnlyLine(proseLine)) {
      paragraphLines.push(proseLine);
    }
  }
  flushParagraph();

  // 2. Split document into sections by headings (ignoring headings inside code fences)
  interface MarkdownSection {
    level: number;
    heading: string;
    contentLines: string[];
  }

  const sections: MarkdownSection[] = [];
  let currentSection: MarkdownSection | null = null;
  inCodeBlock = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      if (currentSection) {
        currentSection.contentLines.push(rawLine);
      }
      continue;
    }

    if (!inCodeBlock) {
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        currentSection = {
          level: headingMatch[1].length,
          heading: stripInlineMarkdown(headingMatch[2]),
          contentLines: [],
        };
        sections.push(currentSection);
        continue;
      }
    }

    if (currentSection) {
      currentSection.contentLines.push(rawLine);
    }
  }

  // 3. Extract features from matching sections (including subsections until same/higher heading)
  const features: string[] = [];
  const consumedFeatureIndices = new Set<number>();

  for (let i = 0; i < sections.length; i++) {
    if (consumedFeatureIndices.has(i)) continue;
    const section = sections[i];
    if (!headingMatchesKeywords(section.heading, FEATURES_HEADING_KEYWORDS)) {
      continue;
    }

    const collectedLines: string[] = [...section.contentLines];
    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].level <= section.level) break;
      consumedFeatureIndices.add(j);
      collectedLines.push(`### ${sections[j].heading}`);
      collectedLines.push(...sections[j].contentLines);
    }

    let codeFence = false;
    for (const rawLine of collectedLines) {
      const t = rawLine.trim();
      if (/^(```|~~~)/.test(t)) {
        codeFence = !codeFence;
        continue;
      }
      if (codeFence) continue;

      const bulletMatch = t.match(/^[-*•]\s+(.*)$/) || t.match(/^\d+[.)]\s+(.*)$/);
      if (bulletMatch) {
        const cleaned = stripInlineMarkdown(bulletMatch[1]);
        if (cleaned) {
          features.push(cleaned);
        }
      }
    }
  }

  // 4. Extract installation & usage markdown from matching sections
  const installBlocks: string[] = [];
  const consumedIndices = new Set<number>();

  for (let i = 0; i < sections.length; i++) {
    if (consumedIndices.has(i)) continue;
    const section = sections[i];
    if (!headingMatchesKeywords(section.heading, INSTALL_USAGE_HEADING_KEYWORDS)) {
      continue;
    }

    const sectionBlockLines: string[] = [
      `### ${section.heading}`,
      ...section.contentLines,
    ];

    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].level <= section.level) break;
      consumedIndices.add(j);
      sectionBlockLines.push(`#### ${sections[j].heading}`);
      sectionBlockLines.push(...sections[j].contentLines);
    }

    const joined = sectionBlockLines.join('\n').trim();
    if (joined) {
      installBlocks.push(joined);
    }
  }

  const installUsageMarkdown =
    installBlocks.length > 0 ? installBlocks.join('\n\n') : null;

  return {
    exists: true,
    rawMarkdown,
    description,
    shortDescription: description ? truncateText(description, 175) : null,
    features,
    installUsageMarkdown,
    htmlUrl,
  };
}

function defaultBlobUrl(repo: string, branch = 'HEAD'): string {
  return `https://github.com/${GITHUB_OWNER}/${encodeURIComponent(
    repo
  )}/blob/${branch}/README.md`;
}

async function fetchRawUrl(
  url: string,
  signal?: AbortSignal
): Promise<{ status: number; text: string | null }> {
  const response = await fetch(url, { method: 'GET', signal });
  if (response.status === 404) {
    return { status: 404, text: null };
  }
  if (!response.ok) {
    return { status: response.status, text: null };
  }
  const text = await response.text();
  return { status: 200, text };
}

export async function fetchRepoReadme(
  repo: string,
  signal?: AbortSignal
): Promise<RepoReadmeState> {
  const encodedRepo = encodeURIComponent(repo);
  const apiReadmeUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${encodedRepo}/readme`;

  let lastStatus: number | null = null;
  let lastError: unknown = null;

  // Primary: GitHub API /readme with Accept: application/vnd.github.raw
  try {
    const res = await fetch(apiReadmeUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.raw',
      },
      signal,
    });

    if (res.status === 404) {
      return {
        status: 'not_found',
        exists: false,
        readme: null,
        errorReason: null,
        errorMessage: null,
      };
    }

    if (res.ok) {
      const markdown = await res.text();
      if (markdown.trim()) {
        return {
          status: 'ready',
          exists: true,
          readme: parseReadmeMarkdown(markdown, defaultBlobUrl(repo, 'HEAD')),
          errorReason: null,
          errorMessage: null,
        };
      }
    } else {
      lastStatus = res.status;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    lastError = err;
  }

  // Fallback 1: JSON metadata -> download_url + exact html_url
  try {
    const jsonRes = await fetch(apiReadmeUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal,
    });

    if (jsonRes.status === 404) {
      return {
        status: 'not_found',
        exists: false,
        readme: null,
        errorReason: null,
        errorMessage: null,
      };
    }

    if (jsonRes.ok) {
      const meta = (await jsonRes.json()) as {
        download_url?: string | null;
        html_url?: string | null;
      };
      if (meta.download_url) {
        const dl = await fetchRawUrl(meta.download_url, signal);
        if (dl.status === 200 && dl.text && dl.text.trim()) {
          return {
            status: 'ready',
            exists: true,
            readme: parseReadmeMarkdown(
              dl.text,
              meta.html_url || defaultBlobUrl(repo, 'HEAD')
            ),
            errorReason: null,
            errorMessage: null,
          };
        }
      }
    } else {
      lastStatus = jsonRes.status;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    lastError = err;
  }

  // Fallback 2 & 3: raw.githubusercontent.com main then master
  const rawBranches = ['main', 'master'] as const;
  let raw404Count = 0;

  for (const branch of rawBranches) {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${encodedRepo}/${branch}/README.md`;
    try {
      const raw = await fetchRawUrl(rawUrl, signal);
      if (raw.status === 404) {
        raw404Count++;
        continue;
      }
      if (raw.status === 200 && raw.text && raw.text.trim()) {
        return {
          status: 'ready',
          exists: true,
          readme: parseReadmeMarkdown(raw.text, defaultBlobUrl(repo, branch)),
          errorReason: null,
          errorMessage: null,
        };
      }
      lastStatus = raw.status;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      lastError = err;
    }
  }

  if (raw404Count === rawBranches.length && lastStatus !== 403 && lastStatus !== 429) {
    return {
      status: 'not_found',
      exists: false,
      readme: null,
      errorReason: null,
      errorMessage: null,
    };
  }

  const errorReason: ReleaseErrorReason =
    lastStatus === 403 || lastStatus === 429
      ? 'rate_limit'
      : lastError
      ? 'network'
      : 'unknown';

  const errorMessage =
    errorReason === 'rate_limit'
      ? 'تم تجاوز حد الطلبات المسموح به من GitHub API مؤقتاً أثناء جلب README. يرجى المحاولة بعد قليل.'
      : errorReason === 'network'
      ? 'تعذر الاتصال بـ GitHub لجلب ملف README. تحقق من اتصال الإنترنت ثم أعد المحاولة.'
      : `تعذر جلب ملف README من GitHub (رمز الاستجابة: ${lastStatus ?? 'غير معروف'}).`;

  return {
    status: 'error',
    exists: false,
    readme: null,
    errorReason,
    errorMessage,
  };
}

export function createInitialReadmeLoadingState(
  apps: AppDefinition[]
): ReadmesMap {
  const map: ReadmesMap = {};
  for (const app of apps) {
    map[app.repo] = {
      status: 'loading',
      exists: false,
      readme: null,
      errorReason: null,
      errorMessage: null,
    };
  }
  return map;
}

export async function fetchAllRepoReadmes(
  apps: AppDefinition[],
  signal?: AbortSignal
): Promise<ReadmesMap> {
  const entries = await Promise.all(
    apps.map(async (app) => {
      const state = await fetchRepoReadme(app.repo, signal);
      return [app.repo, state] as const;
    })
  );

  return Object.fromEntries(entries);
}

// Server-side READMEs (GET /api/readmes) — the same source the assistant
// context uses, fetched once (authenticated + 5-minute KV cache) instead of
// up to 16+ unauthenticated GitHub API calls from the browser. On the
// static GitHub Pages copy there is no Functions endpoint, so any failure
// returns null and the caller keeps the client-side GitHub data.

export interface ServerReadmeItem {
  repo: string;
  status: 'ready' | 'not_found' | 'error';
  markdown: string | null;
  htmlUrl: string | null;
}

export interface ServerReadmesResponse {
  ok: boolean;
  source: 'live' | 'cache';
  apps: ServerReadmeItem[];
}

export async function fetchServerReadmes(
  signal?: AbortSignal
): Promise<ServerReadmeItem[] | null> {
  try {
    const response = await fetch('/api/readmes', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as Partial<ServerReadmesResponse>;
    if (!data || data.ok !== true || !Array.isArray(data.apps)) {
      return null;
    }
    return data.apps as ServerReadmeItem[];
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return null;
  }
}

// Build the readmes map purely from server data. Repos the server could
// not fetch ('error') are marked as errors here; the caller retries those
// repos with the direct GitHub fetch as a fallback.
export function buildReadmesFromServer(
  items: ServerReadmeItem[]
): ReadmesMap {
  const map: ReadmesMap = {};
  for (const item of items) {
    if (item.status === 'ready' && item.markdown && item.markdown.trim()) {
      map[item.repo] = {
        status: 'ready',
        exists: true,
        readme: parseReadmeMarkdown(
          item.markdown,
          item.htmlUrl || defaultBlobUrl(item.repo, 'HEAD')
        ),
        errorReason: null,
        errorMessage: null,
      };
    } else if (item.status === 'not_found') {
      map[item.repo] = {
        status: 'not_found',
        exists: false,
        readme: null,
        errorReason: null,
        errorMessage: null,
      };
    } else {
      map[item.repo] = {
        status: 'error',
        exists: false,
        readme: null,
        errorReason: 'unknown',
        errorMessage: 'تعذّر جلب ملف README من GitHub حالياً.',
      };
    }
  }
  return map;
}
