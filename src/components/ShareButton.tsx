import { Check, Link2, MessageCircle, Send, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  copyText,
  nativeShare,
  telegramShareUrl,
  whatsappShareUrl,
} from '../lib/share';

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  label?: string;
  size?: 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<ShareButtonProps['size']>, string> = {
  md: 'min-h-[48px] px-4 py-2.5 rounded-lg text-sm',
  lg: 'min-h-[54px] px-7 py-3.5 rounded-xl text-base',
};

// «مشاركة» button in the Cyber Dark style. Tries the native share sheet
// first (Android Chrome, iOS Safari); when the browser has no share sheet,
// opens a small menu with WhatsApp, Telegram and copy-link.
export function ShareButton({
  title,
  text,
  url,
  label = 'مشاركة',
  size = 'md',
}: ShareButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const handleShareClick = async () => {
    const result = await nativeShare({ title, text, url });
    if (result === 'unavailable') {
      setMenuOpen((open) => !open);
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleShareClick}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`${sizeClasses[size]} font-semibold text-sky-200 bg-[#081530] border border-sky-400/30 hover:border-[#00b4ff] hover:text-white transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto`}
      >
        <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="إغلاق قائمة المشاركة"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-transparent"
          />
          <div
            role="menu"
            className="absolute bottom-full end-0 z-40 mb-2 w-[220px] rounded-xl border border-sky-400/30 bg-[#071127] p-1.5 shadow-2xl shadow-black/60"
          >
            <a
              href={whatsappShareUrl(text, url)}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-100 hover:bg-sky-400/10 transition-colors"
            >
              <MessageCircle
                className="w-4 h-4 text-emerald-300 shrink-0"
                aria-hidden="true"
              />
              <span>مشاركة عبر واتساب</span>
            </a>
            <a
              href={telegramShareUrl(text, url)}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-100 hover:bg-sky-400/10 transition-colors"
            >
              <Send
                className="w-4 h-4 text-sky-300 shrink-0"
                aria-hidden="true"
              />
              <span>مشاركة عبر تيليجرام</span>
            </a>
            <button
              type="button"
              role="menuitem"
              onClick={handleCopyLink}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-100 hover:bg-sky-400/10 transition-colors"
            >
              {copied ? (
                <Check
                  className="w-4 h-4 text-emerald-300 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Link2
                  className="w-4 h-4 text-sky-300 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>{copied ? 'تم نسخ الرابط' : 'نسخ الرابط'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
