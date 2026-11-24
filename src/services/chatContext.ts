import { APPS_CATALOG, getRepoGithubUrl } from '../data/apps';
import { ReleasesMap } from '../types/app';

export interface AppContextPayload {
  repo: string;
  name: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  githubUrl: string;
  status: 'loading' | 'ready' | 'not_found' | 'error';
  tagName: string | null;
  publishedAt: string | null;
  formattedDate: string | null;
  releaseBody: string | null;
  apkUrl: string | null;
  isNew: boolean;
}

export function buildAppsContextPayload(
  releases: ReleasesMap
): AppContextPayload[] {
  return APPS_CATALOG.map((app) => {
    const state = releases[app.repo];
    const release = state?.release ?? null;

    return {
      repo: app.repo,
      name: app.name,
      category: app.category,
      shortDescription: app.shortDescription,
      fullDescription: app.fullDescription,
      features: app.features,
      githubUrl: getRepoGithubUrl(app.repo),
      status: state?.status ?? 'loading',
      tagName: release?.tagName ?? null,
      publishedAt: release?.publishedAt ?? null,
      formattedDate: release?.formattedDate ?? null,
      releaseBody: release?.body ?? null,
      apkUrl: release?.apkUrl ?? null,
      isNew: release?.isNew ?? false,
    };
  });
}
