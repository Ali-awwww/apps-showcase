import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { TUTORIALS } from '../data/tutorials';

interface TutorialDetailPageProps {
  tutorialId: string;
  onBack: () => void;
}

export function TutorialDetailPage({ tutorialId, onBack }: TutorialDetailPageProps) {
  const tutorial = TUTORIALS.find((t) => t.id === tutorialId);
  const [copied, setCopied] = useState(false);

  if (!tutorial) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-[#071127] border border-sky-400/25 hover:border-[#00b4ff] text-sky-200 hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span>كل الشروحات</span>
        </button>
        <div className="rounded-2xl border border-sky-400/20 bg-[#071127]/90 p-10 text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-white">
            الشرح غير موجود
          </h1>
          <p className="text-sm text-slate-300">
            ربما تغيّر الرابط أو حُذف هذا الشرح.
          </p>
        </div>
      </main>
    );
  }

  const copyCode = async () => {
    if (!tutorial.inviteCode) return;
    try {
      await navigator.clipboard.writeText(tutorial.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="min-h-[44px] px-4 py-2 rounded-lg bg-[#071127] border border-sky-400/25 hover:border-[#00b4ff] text-sky-200 hover:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors self-start"
      >
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
        <span>كل الشروحات</span>
      </button>

      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {tutorial.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed break-words">
          {tutorial.description}
        </p>
      </div>

      <ol className="space-y-5">
        {tutorial.steps.map((step, idx) => (
          <li key={idx} className="cyber-card rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#00b4ff] text-[#030712] text-sm font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <h2 className="font-display text-base font-bold text-white">
                {step.title}
              </h2>
            </div>
            <p className="text-sm sm:text-[15px] text-slate-300 leading-relaxed break-words">
              {step.text}
            </p>
          </li>
        ))}
      </ol>

      {tutorial.inviteCode && (
        <section className="cyber-card rounded-2xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-sky-200">
            كود الدعوة
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <code
              dir="ltr"
              className="font-mono-tabular text-lg font-bold px-4 py-2.5 rounded-xl bg-[#030917] border border-sky-400/30 text-sky-200 tracking-widest"
            >
              {tutorial.inviteCode}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="min-h-[44px] px-4 py-2 rounded-xl font-semibold text-sm text-sky-200 bg-[#081530] border border-sky-400/30 hover:border-[#00b4ff] hover:text-white transition-colors inline-flex items-center gap-2"
            >
              {copied ? (
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
            </button>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed break-words">
            أدخل الكود خلال 48 ساعة من إنشاء الحساب. تحصل على مليار رمز، ويحصل
            صاحب الكود على مليار رمز أيضًا.
          </p>
        </section>
      )}

      {tutorial.links.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-bold text-sky-200">
            روابط التحميل
          </h2>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
            {tutorial.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cyber-btn-primary min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                <span>{link.label}</span>
                <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      )}

      {tutorial.note && (
        <p className="rounded-xl bg-[#07132c] border border-sky-400/25 px-4 py-3 text-sm text-sky-200 leading-relaxed break-words">
          {tutorial.note}
        </p>
      )}
    </main>
  );
}
