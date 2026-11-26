export type AppCategory = 'إسلامي' | 'أدوات' | 'تسوق' | 'تطوير';

export type FilterCategory = 'الكل' | AppCategory;

export type AppIconId =
  | 'muslim-assistant'
  | 'phone-agent'
  | 'abu-jrin-market'
  | '-Vibe-coding'
  | '-AW'
  | 'adhan-reminder'
  | 'sadiq-al-muslim'
  | 'sibaq-al-maalumat';

export interface AppDefinition {
  repo: string;
  name: string;
  category: AppCategory;
  iconId: AppIconId;
  /** Android applicationId, when the app ships as an Android app. Used by the "Open the app" button (intent URL). Absent for web-only apps. */
  androidPackage?: string;
  /** Custom URL scheme the Android app declares (intent-filter). Required for the "Open the app" button to launch it. */
  androidScheme?: string;
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

export interface ParsedReadme {
  exists: true;
  rawMarkdown: string;
  description: string | null;
  shortDescription: string | null;
  features: string[];
  installUsageMarkdown: string | null;
  htmlUrl: string;
}

export type ReadmeLoadStatus = 'loading' | 'ready' | 'not_found' | 'error';

export interface RepoReadmeState {
  status: ReadmeLoadStatus;
  exists: boolean;
  readme: ParsedReadme | null;
  errorReason: ReleaseErrorReason | null;
  errorMessage: string | null;
}

export type ReadmesMap = Record<string, RepoReadmeState>;
