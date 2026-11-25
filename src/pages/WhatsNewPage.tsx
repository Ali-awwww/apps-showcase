import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Download,
  RotateCw,
} from 'lucide-react';
import { useMemo } from 'react';
import { AppGeometricIcon } from '../components/AppGeometricIcon';
import { ReleaseNotes } from '../components/ReleaseNotes';
import { APPS_CATALOG } from '../data/apps';
import { AppDefinition, ParsedRelease, ReleasesMap } from '../types/app';

interface WhatsNewPageProps {
  releases: ReleasesMap;
  latestAgeText?: string | null;
  isAnyLoading: boolean;
  hasAnyError: boolean;
  errorBannerMessage: string | null;
  onRetry: () => void;
  onOpenDetails: (repo: string) => void;
  onBackHome: () => void;
}

interface ReleasedAppEntry {
  app: AppDefinition;
  release: ParsedRelease;
}

export function WhatsNewPage({
  releases,
  latestAgeText,
  isAnyLoading,
  hasAnyError,
  errorBannerMessage,
  onRetry,
  onOpenDetails,
  onBackHome,
}: WhatsNewPageProps) {
  const releasedApps = useMemo<ReleasedAppEntry[]>(() => {
    const entries: ReleasedAppEntry[] = [];

    for (const app of APPS_CATALOG) {
      const state = releases[app.repo];
      if (state?.status === 'ready' && state.release) {
        entries.push({ app, release: state.release });
      }
    }

    return entries.sort((a, b) => {
      const timeA = new Date(a.release.publishedAt).getTime() || 0;
      const timeB = new Date(b.release.publishedAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [releases]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            ما الجديد
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            جميع التطبيقات التي لها إصدار منشور على GitHub، مرتبة من الأحدث إلى
            الأقدم.
          </p>
          {latestAgeText && (
            <p className="text-xs sm:text-sm text-sky-300/85">{latestAgeText}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onBackHome}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-[#071127] border border-sky-400/25 hover:border-[#00b4ff] text-sky-200 hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors self-start sm:self-auto shrink-0"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span>كل التطبيقات</span>
        </button>
      </div>

      {isAnyLoading && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#07132c] border border-sky-400/25 text-sm text-sky-200"
        >
          <RotateCw
            className="w-4 h-4 text-[#00b4ff] animate-spin shrink-0"
            aria-hidden="true"
          />
          <span>جاري فحص أحدث الإصدارات من GitHub...</span>
        </div>
      )}

      {hasAnyError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 rounded-xl bg-amber-950/40 border border-amber-400/40 text-amber-100"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-amber-300 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm">
              {errorBannerMessage ||
                'تعذر جلب بعض الإصدارات من GitHub بسبب خطأ في الشبكة أو حد الطلبات.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-sm hover:bg-amber-300 inline-flex items-center justify-center gap-2 shrink-0"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      {releasedApps.length > 0 ? (
        <div className="space-y-6">
          {releasedApps.map(({ app, release }) => (
            <article
              key={app.repo}
              className="cyber-card rounded-2xl p-6 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <AppGeometricIcon iconId={app.iconId} size="md" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="font-display text-xl font-bold text-white">
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
                      {release.isNew && (
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-[#00b4ff] text-[#030712] rounded-sm">
                          جديد
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-400">
                      <span className="text-slate-300">{app.category}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className="font-mono-tabular text-sky-300 font-semibold"
                        dir="ltr"
                      >
                        {release.tagName}
                      </span>
                      {release.formattedDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{release.formattedDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {release.apkUrl ? (
                    <a
                      href={release.apkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cyber-btn-primary min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>تحميل APK</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-900 text-slate-400 border border-slate-700 cursor-not-allowed whitespace-nowrap"
                    >
                      قريباً
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenDetails(app.repo)}
                    className="min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-sm text-sky-200 bg-[#081530] border border-sky-400/30 hover:border-[#00b4ff] hover:text-white transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>التفاصيل</span>
                    <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-sky-400/15 space-y-2">
                <h3 className="font-display text-sm font-bold text-sky-200">
                  ملاحظات التغيير
                </h3>
                <ReleaseNotes body={release.body} compact />
              </div>
            </article>
          ))}
        </div>
      ) : (
        !isAnyLoading && (
          <div className="rounded-2xl border border-sky-400/20 bg-[#071127]/90 p-10 text-center space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              لا توجد إصدارات منشورة حتى الآن
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
              لم يتم نشر أي إصدار فعلي في مستودعات التطبيقات على GitHub بعد.
              ستظهر التحديثات هنا تلقائياً فور نشر أول إصدار.
            </p>
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#081530] border border-sky-400/35 hover:border-[#00b4ff] text-sky-200 hover:text-white text-sm font-semibold transition-colors"
            >
              تصفح جميع التطبيقات
            </button>
          </div>
        )
      )}
    </main>
  );
}
