import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CyberBackground } from './components/CyberBackground';
import { Footer } from './components/Footer';
import { GeminiChatbot } from './components/GeminiChatbot';
import { Navbar } from './components/Navbar';
import { APPS_CATALOG } from './data/apps';
import { AppDetailPage } from './pages/AppDetailPage';
import { HomePage } from './pages/HomePage';
import { WhatsNewPage } from './pages/WhatsNewPage';
import {
  createInitialLoadingState,
  fetchAllRepoReleases,
} from './services/github';
import {
  createInitialReadmeLoadingState,
  fetchAllRepoReadmes,
} from './services/readme';
import { ReadmesMap, ReleasesMap } from './types/app';

function parseHashRoute(): string {
  const raw = window.location.hash;
  if (!raw || raw === '#' || raw === '#/') {
    return '/';
  }
  const normalized = raw.startsWith('#') ? raw.slice(1) : raw;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export default function App() {
  const [route, setRoute] = useState<string>(parseHashRoute);
  const [releases, setReleases] = useState<ReleasesMap>(() =>
    createInitialLoadingState(APPS_CATALOG)
  );
  const [readmes, setReadmes] = useState<ReadmesMap>(() =>
    createInitialReadmeLoadingState(APPS_CATALOG)
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadAllData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setReleases(createInitialLoadingState(APPS_CATALOG));
    setReadmes(createInitialReadmeLoadingState(APPS_CATALOG));

    try {
      const [releaseResults, readmeResults] = await Promise.all([
        fetchAllRepoReleases(APPS_CATALOG, controller.signal),
        fetchAllRepoReadmes(APPS_CATALOG, controller.signal),
      ]);

      if (!controller.signal.aborted) {
        setReleases(releaseResults);
        setReadmes(readmeResults);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }
  }, []);

  useEffect(() => {
    loadAllData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadAllData]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute());
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const targetHash = `#${path.startsWith('/') ? path : `/${path}`}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      setRoute(parseHashRoute());
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const openDetails = useCallback(
    (repo: string) => {
      navigate(`/app/${encodeURIComponent(repo)}`);
    },
    [navigate]
  );

  const statusSummary = useMemo(() => {
    const releaseStates = Object.values(releases);
    const readmeStates = Object.values(readmes);

    const isAnyLoading =
      releaseStates.some((s) => s.status === 'loading') ||
      readmeStates.some((s) => s.status === 'loading');

    const releaseErrors = releaseStates.filter((s) => s.status === 'error');
    const readmeErrors = readmeStates.filter((s) => s.status === 'error');
    const allErrors = [...releaseErrors, ...readmeErrors];

    const hasAnyError = allErrors.length > 0;
    const rateLimitError = allErrors.find((s) => s.errorReason === 'rate_limit');
    const errorBannerMessage =
      rateLimitError?.errorMessage ?? allErrors[0]?.errorMessage ?? null;

    return {
      isAnyLoading,
      hasAnyError,
      errorBannerMessage,
      isReleasesLoading: releaseStates.some((s) => s.status === 'loading'),
      hasReleaseError: releaseErrors.length > 0,
      releaseErrorMessage:
        releaseErrors.find((s) => s.errorReason === 'rate_limit')
          ?.errorMessage ??
        releaseErrors[0]?.errorMessage ??
        null,
    };
  }, [releases, readmes]);

  const renderPage = () => {
    if (route === '/new') {
      return (
        <WhatsNewPage
          releases={releases}
          isAnyLoading={statusSummary.isReleasesLoading}
          hasAnyError={statusSummary.hasReleaseError}
          errorBannerMessage={statusSummary.releaseErrorMessage}
          onRetry={loadAllData}
          onOpenDetails={openDetails}
          onBackHome={() => navigate('/')}
        />
      );
    }

    if (route.startsWith('/app/')) {
      const encodedRepo = route.slice('/app/'.length);
      let decodedRepo = encodedRepo;
      try {
        decodedRepo = decodeURIComponent(encodedRepo);
      } catch {
        decodedRepo = encodedRepo;
      }

      return (
        <AppDetailPage
          repo={decodedRepo}
          releases={releases}
          readmes={readmes}
          onBackHome={() => navigate('/')}
          onRetry={loadAllData}
        />
      );
    }

    return (
      <HomePage
        releases={releases}
        readmes={readmes}
        isAnyLoading={statusSummary.isAnyLoading}
        hasAnyError={statusSummary.hasAnyError}
        errorBannerMessage={statusSummary.errorBannerMessage}
        onRetry={loadAllData}
        onOpenDetails={openDetails}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col relative text-slate-100 pb-14 sm:pb-0">
      <CyberBackground />
      <Navbar currentPath={route} onNavigate={navigate} />
      <div className="flex-1">{renderPage()}</div>
      <Footer />
      <GeminiChatbot releases={releases} readmes={readmes} />
    </div>
  );
}
