import { ExternalLink } from 'lucide-react';
import { GITHUB_PROFILE_URL } from '../data/apps';

export function Footer() {
  return (
    <footer className="border-t border-sky-400/20 bg-[#030816]/90 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-right">
          <span className="font-display font-bold text-slate-200">
            منصة عرض تطبيقات المطور أبو معاذ
          </span>
          <span aria-hidden="true">·</span>
          <span>بيانات الإصدارات مباشرة من مستودعات GitHub العامة</span>
        </div>

        <a
          href={GITHUB_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-sky-300 hover:text-white border border-sky-400/25 hover:border-[#00b4ff] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <span className="font-mono-tabular">github.com/Ali-awwww</span>
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
