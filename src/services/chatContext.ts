import { APPS_CATALOG, getRepoGithubUrl } from '../data/apps';
import { ReadmesMap, ReleasesMap } from '../types/app';

export interface AppContextPayload {
  repo: string;
  name: string;
  category: string;
  githubUrl: string;
  readmeStatus: 'loading' | 'ready' | 'not_found' | 'error';
  readmeExists: boolean;
  readmeUrl: string | null;
  readmeDescription: string | null;
  readmeFeatures: string[];
  readmeInstallUsage: string | null;
  status: 'loading' | 'ready' | 'not_found' | 'error';
  tagName: string | null;
  publishedAt: string | null;
  formattedDate: string | null;
  releaseBody: string | null;
  apkUrl: string | null;
  isNew: boolean;
}

export function buildAppsContextPayload(
  releases: ReleasesMap,
  readmes: ReadmesMap
): AppContextPayload[] {
  return APPS_CATALOG.map((app) => {
    const releaseState = releases[app.repo];
    const release = releaseState?.release ?? null;

    const readmeState = readmes[app.repo];
    const readme = readmeState?.readme ?? null;

    return {
      repo: app.repo,
      name: app.name,
      category: app.category,
      githubUrl: getRepoGithubUrl(app.repo),
      readmeStatus: readmeState?.status ?? 'loading',
      readmeExists: Boolean(readmeState?.exists && readme),
      readmeUrl: readme?.htmlUrl ?? null,
      readmeDescription: readme?.description ?? null,
      readmeFeatures: readme?.features ?? [],
      readmeInstallUsage: readme?.installUsageMarkdown ?? null,
      status: releaseState?.status ?? 'loading',
      tagName: release?.tagName ?? null,
      publishedAt: release?.publishedAt ?? null,
      formattedDate: release?.formattedDate ?? null,
      releaseBody: release?.body ?? null,
      apkUrl: release?.apkUrl ?? null,
      isNew: release?.isNew ?? false,
    };
  });
}
