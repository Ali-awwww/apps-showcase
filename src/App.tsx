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
import { ReleasesMap } from './types/app';

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
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadReleases = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setReleases(createInitialLoadingState(APPS_CATALOG));

    try {
      const results = await fetchAllRepoReleases(
        APPS_CATALOG,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setReleases(results);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }
  }, []);

  useEffect(() => {
    loadReleases();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadReleases]);

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
    const states = Object.values(releases);
    const isAnyLoading = states.some((s) => s.status === 'loading');
    const errorStates = states.filter((s) => s.status === 'error');
    const hasAnyError = errorStates.length > 0;
    const rateLimitError = errorStates.find(
      (s) => s.errorReason === 'rate_limit'
    );
    const errorBannerMessage =
      rateLimitError?.errorMessage ?? errorStates[0]?.errorMessage ?? null;

    return {
      isAnyLoading,
      hasAnyError,
      errorBannerMessage,
    };
  }, [releases]);

  const renderPage = () => {
    if (route === '/new') {
      return (
        <WhatsNewPage
          releases={releases}
          isAnyLoading={statusSummary.isAnyLoading}
          hasAnyError={statusSummary.hasAnyError}
          errorBannerMessage={statusSummary.errorBannerMessage}
          onRetry={loadReleases}
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
          onBackHome={() => navigate('/')}
          onRetry={loadReleases}
        />
      );
    }

    return (
      <HomePage
        releases={releases}
        isAnyLoading={statusSummary.isAnyLoading}
        hasAnyError={statusSummary.hasAnyError}
        errorBannerMessage={statusSummary.errorBannerMessage}
        onRetry={loadReleases}
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
      <GeminiChatbot releases={releases} />
    </div>
  );
}
