import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { TUTORIALS } from '../data/tutorials';

interface TutorialsPageProps {
  onOpenTutorial: (id: string) => void;
  onBackHome: () => void;
}

export function TutorialsPage({ onOpenTutorial, onBackHome }: TutorialsPageProps) {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            الشروحات
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            شروحات خطوة بخطوة لاستخدام التطبيقات والخدمات.
          </p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {TUTORIALS.map((tutorial) => (
          <article
            key={tutorial.id}
            className="cyber-card rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <BookOpen
                className="w-6 h-6 text-[#00b4ff] shrink-0 mt-1"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-white">
                  {tutorial.title}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed break-words">
                  {tutorial.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenTutorial(tutorial.id)}
              className="min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-sm text-sky-200 bg-[#081530] border border-sky-400/30 hover:border-[#00b4ff] hover:text-white transition-colors inline-flex items-center gap-2"
            >
              <span>اقرأ الشرح</span>
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
