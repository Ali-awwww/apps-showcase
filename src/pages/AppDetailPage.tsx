import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  ImageOff,
  RotateCw,
} from 'lucide-react';
import { AppGeometricIcon } from '../components/AppGeometricIcon';
import { QrCodeBox } from '../components/QrCodeBox';
import { ReleaseNotes } from '../components/ReleaseNotes';
import { APPS_CATALOG, getRepoGithubUrl } from '../data/apps';
import { formatFileSize } from '../services/github';
import { ReleasesMap } from '../types/app';

interface AppDetailPageProps {
  repo: string;
  releases: ReleasesMap;
  onBackHome: () => void;
  onRetry: () => void;
}

export function AppDetailPage({
  repo,
  releases,
  onBackHome,
  onRetry,
}: AppDetailPageProps) {
  const app = APPS_CATALOG.find((item) => item.repo === repo);

  if (!app) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-2xl border border-sky-400/25 bg-[#071127] p-8 sm:p-10 text-center space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">
            التطبيق غير موجود
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            تعذر العثور على التطبيق المطلوب في قائمة المنصة.
          </p>
          <button
            type="button"
            onClick={onBackHome}
            className="cyber-btn-primary min-h-[48px] px-6 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            <span>العودة إلى الرئيسية</span>
          </button>
        </div>
      </main>
    );
  }

  const releaseState = releases[app.repo] ?? {
    status: 'loading',
    release: null,
    errorReason: null,
    errorMessage: null,
  };

  const { status, release, errorMessage } = releaseState;
  const hasRelease = status === 'ready' && release !== null;
  const hasApk = hasRelease && Boolean(release.apkUrl);
  const apkSizeLabel = hasRelease ? formatFileSize(release.apkSizeBytes) : null;
  const githubRepoUrl = getRepoGithubUrl(app.repo);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 space-y-8">
      <div>
        <button
          type="button"
          onClick={onBackHome}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-[#071127] border border-sky-400/25 hover:border-[#00b4ff] text-sky-200 hover:text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span>العودة إلى الرئيسية</span>
        </button>
      </div>

      <section className="rounded-2xl border border-sky-400/25 bg-[#060f24]/95 p-6 sm:p-8 space-y-7 relative overflow-hidden">
        <div
          className="absolute top-0 inset-x-0 h-[1px] cyber-glow-line"
          aria-hidden="true"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4 sm:gap-5">
            <AppGeometricIcon iconId={app.iconId} size="lg" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  {app.name}
                </h1>
                {hasRelease && release.isNew && (
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-[#00b4ff] text-[#030712] rounded-sm">
                    جديد
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-300">
                <span>التصنيف: {app.category}</span>
                <span aria-hidden="true">·</span>
                {status === 'loading' && (
                  <span className="text-sky-300">جاري جلب الإصدار...</span>
                )}
                {status === 'error' && (
                  <span className="text-amber-300">تعذر جلب الإصدار</span>
                )}
                {status === 'not_found' && (
                  <span className="text-sky-300 font-semibold">قريباً</span>
                )}
                {hasRelease && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>

          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] px-5 py-3 rounded-xl bg-[#081530] border border-sky-400/35 hover:border-[#00b4ff] text-sky-200 hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <span>عرض المستودع على GitHub</span>
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
          </a>
        </div>

        <p className="text-base text-slate-200 leading-relaxed">
          {app.fullDescription}
        </p>

        {status === 'error' && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-950/40 border border-amber-400/40 text-amber-100"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-amber-300 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-sm">
                {errorMessage || 'تعذر جلب بيانات الإصدار من GitHub.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-sm hover:bg-amber-300 inline-flex items-center justify-center gap-2 shrink-0"
            >
              <RotateCw className="w-4 h-4" aria-hidden="true" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        )}

        <div className="pt-5 border-t border-sky-400/15 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
          <div className="flex-1 space-y-3">
            {hasApk && release?.apkUrl ? (
              <>
                <a
                  href={release.apkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cyber-btn-primary w-full sm:w-auto min-h-[54px] px-7 py-3.5 rounded-xl font-bold text-base inline-flex items-center justify-center gap-3"
                >
                  <Download className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>تحميل APK</span>
                </a>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-400">
                  {release.apkName && (
                    <span className="font-mono-tabular text-slate-300" dir="ltr">
                      {release.apkName}
                    </span>
                  )}
                  {apkSizeLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular" dir="ltr">
                        {apkSizeLabel}
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="w-full sm:w-auto min-h-[54px] px-8 py-3.5 rounded-xl font-bold text-base bg-slate-900 text-slate-400 border border-slate-700 cursor-not-allowed inline-flex items-center justify-center"
                >
                  {status === 'loading' ? 'جاري التحقق...' : 'قريباً'}
                </button>
                <p className="text-xs sm:text-sm text-slate-400">
                  {status === 'loading'
                    ? 'جاري فحص أحدث إصدار من مستودع GitHub...'
                    : hasRelease && !release?.apkUrl
                    ? 'الإصدار منشور بدون ملف APK مرفق حالياً.'
                    : 'لم يُنشر ملف APK لهذا التطبيق حتى الآن.'}
                </p>
              </div>
            )}
          </div>

          {hasApk && release?.apkUrl && (
            <QrCodeBox url={release.apkUrl} appName={app.name} />
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-sky-400/20 bg-[#071127]/90 p-6 space-y-4">
          <h2 className="font-display text-lg sm:text-xl font-bold text-white">
            المزايا الرئيسية
          </h2>
          <ul className="space-y-3">
            {app.features.map((feature, index) => (
              <li
                key={index}
                className="flex items-start gap-3 text-sm sm:text-[15px] text-slate-200 leading-relaxed"
              >
                <Check
                  className="w-4 h-4 text-[#00b4ff] shrink-0 mt-1"
                  aria-hidden="true"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-sky-400/20 bg-[#071127]/90 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              ملاحظات الإصدار الأخير
            </h2>
            {hasRelease && (
              <span
                className="font-mono-tabular text-xs sm:text-sm text-sky-300 font-semibold"
                dir="ltr"
              >
                {release.tagName}
              </span>
            )}
          </div>

          {status === 'loading' && (
            <p className="text-sm text-slate-400">
              جاري جلب ملاحظات التغيير من GitHub...
            </p>
          )}

          {status === 'not_found' && (
            <p className="text-sm sm:text-[15px] text-slate-300 leading-relaxed">
              قريباً — لا يوجد إصدار منشور بعد في مستودع التطبيق على GitHub.
            </p>
          )}

          {status === 'error' && (
            <p className="text-sm text-amber-200/90">
              تعذر عرض ملاحظات التغيير بسبب مشكلة في الاتصال بـ GitHub.
            </p>
          )}

          {hasRelease && <ReleaseNotes body={release.body} />}
        </section>
      </div>

      <section className="rounded-2xl border border-sky-400/20 bg-[#071127]/90 p-6 space-y-4">
        <h2 className="font-display text-lg sm:text-xl font-bold text-white">
          لقطات الشاشة
        </h2>
        <div className="rounded-xl border border-dashed border-sky-400/25 bg-[#040a18] py-10 px-6 flex flex-col items-center justify-center gap-3 text-center">
          <ImageOff
            className="w-7 h-7 text-sky-300/60"
            aria-hidden="true"
          />
          <p className="text-sm sm:text-base font-medium text-slate-300">
            لا توجد لقطات شاشة منشورة بعد في المستودع
          </p>
        </div>
      </section>
    </main>
  );
}
