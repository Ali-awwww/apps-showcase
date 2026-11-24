import { ArrowLeft, Download } from 'lucide-react';
import { AppDefinition, RepoReleaseState } from '../types/app';
import { AppGeometricIcon } from './AppGeometricIcon';

interface AppCardProps {
  app: AppDefinition;
  releaseState: RepoReleaseState;
  onOpenDetails: (repo: string) => void;
}

export function AppCard({
  app,
  releaseState,
  onOpenDetails,
}: AppCardProps) {
  const { status, release } = releaseState;
  const hasRelease = status === 'ready' && release !== null;
  const hasApk = hasRelease && Boolean(release.apkUrl);
  const isNew = hasRelease && release.isNew;

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button')) {
      return;
    }
    onOpenDetails(app.repo);
  };

  const renderReleaseMeta = () => {
    if (status === 'loading') {
      return <span className="text-sky-300/80">جاري جلب الإصدار...</span>;
    }
    if (status === 'error') {
      return <span className="text-amber-300">تعذر جلب الإصدار</span>;
    }
    if (status === 'not_found' || !release) {
      return <span className="text-sky-300 font-semibold">قريباً</span>;
    }

    return (
      <>
        <span className="font-mono-tabular text-sky-300 font-semibold" dir="ltr">
          {release.tagName}
        </span>
        {release.formattedDate && (
          <>
            <span aria-hidden="true">·</span>
            <span>{release.formattedDate}</span>
          </>
        )}
      </>
    );
  };

  return (
    <article
      onClick={handleCardClick}
      className="cyber-card rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-5 cursor-pointer relative overflow-hidden"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <AppGeometricIcon iconId={app.iconId} size="md" />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-snug">
                  <a
                    href={`#/app/${encodeURIComponent(app.repo)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenDetails(app.repo);
                    }}
                    className="hover:text-sky-300 transition-colors"
                  >
                    {app.name}
                  </a>
                </h2>
                {isNew && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-[#00b4ff] text-[#030712] rounded-sm whitespace-nowrap shrink-0">
                    جديد
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-[13px] text-slate-400">
                <span className="text-slate-300 font-medium">{app.category}</span>
                <span aria-hidden="true">·</span>
                {renderReleaseMeta()}
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm sm:text-[15px] text-slate-300 leading-relaxed">
          {app.shortDescription}
        </p>
      </div>

      <div className="pt-4 border-t border-sky-400/15 flex flex-col sm:flex-row items-stretch gap-2.5">
        {hasApk && release?.apkUrl ? (
          <a
            href={release.apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cyber-btn-primary flex-1 min-h-[48px] px-4 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>تحميل APK</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-lg font-semibold text-sm bg-slate-900/90 text-slate-400 border border-slate-700/80 cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span>{status === 'loading' ? 'جاري التحقق...' : 'قريباً'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenDetails(app.repo)}
          className="min-h-[48px] px-4 py-2.5 rounded-lg font-semibold text-sm text-sky-200 bg-[#081530] border border-sky-400/30 hover:border-[#00b4ff] hover:text-white transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <span>التفاصيل</span>
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
