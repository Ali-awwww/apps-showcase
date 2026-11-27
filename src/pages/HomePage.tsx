import { AlertTriangle, RotateCw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppCard } from '../components/AppCard';
import { ShareButton } from '../components/ShareButton';
import { buildPlatformShareUrl, buildShareText } from '../lib/share';
import { APPS_CATALOG, FILTER_CATEGORIES } from '../data/apps';
import { FilterCategory, ReadmesMap, ReleasesMap } from '../types/app';

interface HomePageProps {
  releases: ReleasesMap;
  readmes: ReadmesMap;
  isAnyLoading: boolean;
  hasAnyError: boolean;
  errorBannerMessage: string | null;
  onRetry: () => void;
  onOpenDetails: (repo: string) => void;
}

export function HomePage({
  releases,
  readmes,
  isAnyLoading,
  hasAnyError,
  errorBannerMessage,
  onRetry,
  onOpenDetails,
}: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<FilterCategory>('الكل');

  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = APPS_CATALOG.filter((app) => {
      const matchesCategory =
        selectedCategory === 'الكل' || app.category === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const readme = readmes[app.repo]?.readme;
      const readmeText = readme
        ? `${readme.description || ''} ${readme.features.join(' ')} ${readme.rawMarkdown}`.toLowerCase()
        : '';

      return (
        app.name.toLowerCase().includes(query) ||
        app.repo.toLowerCase().includes(query) ||
        app.category.toLowerCase().includes(query) ||
        readmeText.includes(query)
      );
    });

    // Sort by latest release first, once the GitHub fetch has finished.
    // Apps with a published release come first (newest first); apps with
    // no release yet («قريباً») or a failed fetch keep their catalog order
    // at the end, so nothing disappears or breaks the page. The «جديد»
    // badge logic is untouched.
    if (isAnyLoading) {
      return filtered;
    }
    const publishedMs = (repo: string): number | null => {
      const state = releases[repo];
      if (state?.status !== 'ready') {
        return null;
      }
      const ms = Date.parse(state.release?.publishedAt ?? '');
      return Number.isFinite(ms) ? ms : null;
    };
    return [...filtered].sort((a, b) => {
      const da = publishedMs(a.repo);
      const db = publishedMs(b.repo);
      if (da !== null && db !== null) {
        return db - da;
      }
      if (da !== null) {
        return -1;
      }
      if (db !== null) {
        return 1;
      }
      return 0;
    });
  }, [searchQuery, selectedCategory, readmes, releases, isAnyLoading]);

  const releasedCount = useMemo(() => {
    return APPS_CATALOG.filter(
      (app) => releases[app.repo]?.status === 'ready'
    ).length;
  }, [releases]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('الكل');
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-8 space-y-8">
      <section className="relative rounded-2xl border border-sky-400/25 bg-[#060f24]/90 p-6 sm:p-10 overflow-hidden">
        <div
          className="absolute top-0 inset-x-0 h-[1px] cyber-glow-line"
          aria-hidden="true"
        />

        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-sky-300 font-medium">
            <span>المطور: أبو معاذ</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {APPS_CATALOG.length} تطبيقات
            </span>
            {!isAnyLoading && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {releasedCount} إصدار متاح
                </span>
              </>
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-4xl lg:text-[42px] font-extrabold text-white leading-tight [text-wrap:balance]">
            منصة عرض تطبيقات المطور أبو معاذ
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            المستودع المباشر لتحميل أحدث إصدارات APK لتطبيقات المطور أبو معاذ،
            مع تحديث فوري لرقم الإصدار وتاريخ النشر وملاحظات التغيير وتفاصيل
            ملفات README مباشرة من GitHub.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <ShareButton
              title="منصة أبو معاذ"
              text={buildShareText()}
              url={buildPlatformShareUrl()}
              label="شارك المنصة"
            />
          </div>
        </div>
      </section>

      <section
        aria-label="قسم الشروحات"
        className="relative rounded-2xl border border-sky-400/25 bg-[#060f24]/90 p-6 sm:p-8 overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-bold text-white">
              قسم الشروحات
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              شرح خطوة بخطوة: كيف تستخدم موس من مصر رغم الحظر — VPN مجاني،
              تحميل التطبيق، إنشاء حساب، وكود الدعوة.
            </p>
          </div>
          <a
            href="#/tutorials"
            className="cyber-btn-primary min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            اقرأ الشرح
          </a>
        </div>
      </section>

      <section aria-label="البحث والتصفية" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <label htmlFor="app-search" className="sr-only">
              ابحث عن تطبيق بالاسم أو الوصف
            </label>
            <Search
              className="w-5 h-5 text-sky-300/80 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="app-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن تطبيق بالاسم أو محتوى README..."
              className="w-full min-h-[48px] pr-12 pl-12 py-3 rounded-xl bg-[#071127] border border-sky-400/25 text-white placeholder:text-slate-400 text-sm sm:text-base focus:border-[#00b4ff] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح البحث"
                className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="تصفية حسب التصنيف"
            className="flex items-center gap-1.5 p-1.5 bg-[#071127] border border-sky-400/20 rounded-xl overflow-x-auto"
          >
            {FILTER_CATEGORIES.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => setSelectedCategory(category)}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#00b4ff] text-[#030712] shadow-[0_0_16px_-4px_rgba(0,180,255,0.65)]'
                      : 'text-slate-300 hover:text-white hover:bg-[#0d1c3d]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
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
            <span>جاري جلب أحدث الإصدارات وملفات README مباشرة من GitHub...</span>
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
              <div className="space-y-1 text-sm">
                <p className="font-bold">تعذر جلب بعض البيانات من GitHub</p>
                <p className="text-amber-200/90">
                  {errorBannerMessage ||
                    'حدث خطأ في الشبكة أو تم تجاوز حد الطلبات المسموح به في GitHub API.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-sm hover:bg-amber-300 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <RotateCw className="w-4 h-4" aria-hidden="true" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        )}
      </section>

      <section aria-label="قائمة التطبيقات">
        {filteredApps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredApps.map((app) => (
              <AppCard
                key={app.repo}
                app={app}
                releaseState={
                  releases[app.repo] ?? {
                    status: 'loading',
                    release: null,
                    errorReason: null,
                    errorMessage: null,
                  }
                }
                readmeState={
                  readmes[app.repo] ?? {
                    status: 'loading',
                    exists: false,
                    readme: null,
                    errorReason: null,
                    errorMessage: null,
                  }
                }
                onOpenDetails={onOpenDetails}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-sky-400/20 bg-[#071127]/90 p-10 text-center space-y-4">
            <p className="font-display text-lg font-bold text-white">
              لا توجد تطبيقات مطابقة لبحثك
            </p>
            <p className="text-sm text-slate-400">
              جرّب تغيير كلمات البحث أو اختيار تصنيف آخر.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#081530] border border-sky-400/40 text-sky-200 hover:text-white hover:border-[#00b4ff] text-sm font-semibold transition-colors"
            >
              عرض جميع التطبيقات
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
