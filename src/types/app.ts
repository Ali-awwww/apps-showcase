export type AppCategory = 'إسلامي' | 'أدوات' | 'تسوق' | 'تطوير';

export type FilterCategory = 'الكل' | AppCategory;

export type AppIconId =
  | 'muslim-assistant'
  | 'phone-agent'
  | 'abu-jrin-market'
  | '-Vibe-coding'
  | '-AW'
  | 'adhan-reminder';

export interface AppDefinition {
  repo: string;
  name: string;
  category: AppCategory;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  iconId: AppIconId;
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubReleaseRaw {
  tag_name: string;
  published_at: string;
  body: string | null;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

export interface ParsedRelease {
  tagName: string;
  publishedAt: string;
  formattedDate: string;
  body: string;
  htmlUrl: string;
  apkUrl: string | null;
  apkName: string | null;
  apkSizeBytes: number | null;
  isNew: boolean;
}

export type ReleaseLoadStatus = 'loading' | 'ready' | 'not_found' | 'error';

export type ReleaseErrorReason = 'rate_limit' | 'network' | 'unknown';

export interface RepoReleaseState {
  status: ReleaseLoadStatus;
  release: ParsedRelease | null;
  errorReason: ReleaseErrorReason | null;
  errorMessage: string | null;
}

export type ReleasesMap = Record<string, RepoReleaseState>;
