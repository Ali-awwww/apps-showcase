import { ExternalLink } from 'lucide-react';
import { GITHUB_PROFILE_URL } from '../data/apps';
import { VisitorCounter } from './VisitorCounter';

interface NavbarProps {
  currentPath: string;
  onNavigate: (hashPath: string) => void;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const isHome = currentPath === '/' || currentPath === '';
  const isNew = currentPath === '/new';
  const isTutorials =
    currentPath === '/tutorials' || currentPath.startsWith('/tutorials/');

  return (
    <header className="sticky top-0 z-40 min-h-14 bg-[#030712]/90 backdrop-blur-md border-b border-sky-400/20">
      <div className="max-w-7xl mx-auto min-h-14 py-1.5 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sm:gap-8">
        <div className="flex flex-col items-start leading-none gap-1 shrink-0">
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-white hover:text-sky-300 transition-colors whitespace-nowrap"
          >
            منصة أبو معاذ
          </a>
          <VisitorCounter />
        </div>

        <nav
          aria-label="التنقل الرئيسي"
          className="flex items-center gap-5 sm:gap-7 text-sm font-medium"
        >
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              isHome
                ? 'border-[#00b4ff] text-sky-300'
                : 'border-transparent text-slate-300 hover:text-white hover:border-sky-400/40'
            }`}
          >
            التطبيقات
          </a>
          <a
            href="#/new"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/new');
            }}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              isNew
                ? 'border-[#00b4ff] text-sky-300'
                : 'border-transparent text-slate-300 hover:text-white hover:border-sky-400/40'
            }`}
          >
            ما الجديد
          </a>
          <a
            href="#/tutorials"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/tutorials');
            }}
            className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              isTutorials
                ? 'border-[#00b4ff] text-sky-300'
                : 'border-transparent text-slate-300 hover:text-white hover:border-sky-400/40'
            }`}
          >
            الشروحات
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <a
            href={GITHUB_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-semibold text-sky-200 bg-[#081530] border border-sky-400/35 rounded-lg hover:border-[#00b4ff] hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}
