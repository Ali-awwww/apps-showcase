import {
  AlertTriangle,
  MessageSquareText,
  RotateCcw,
  RotateCw,
  Send,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { sendFirebaseAiChat } from '../services/aiChat';
import { buildAppsContextPayload } from '../services/chatContext';
import { ReadmesMap, ReleasesMap } from '../types/app';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface GeminiChatbotProps {
  releases: ReleasesMap;
  readmes: ReadmesMap;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
    'أهلاً بك في منصة عرض تطبيقات المطور أبو معاذ!\n' +
    'تضم المنصة 6 تطبيقات: «مساعد المسلم»، «مذكر الأذان»، «سوق قرية أبو جرين»، «وكيل الهاتف»، «فيب كودينغ»، و«AW».\n' +
    'أخبرني بما تبحث عنه لأرشّح لك التطبيق المناسب من بيانات GitHub وملفات README الحية، أو اسألني عن آخر الإصدارات وخطوات التحميل.',
};

const QUICK_SUGGESTIONS = [
  'ما أفضل تطبيق للصلاة؟',
  'كيف أحمّل مساعد المسلم؟',
  'ما آخر إصدار؟',
  'هل التطبيقات مجانية؟',
];

export function GeminiChatbot({ releases, readmes }: GeminiChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedMessageText, setFailedMessageText] = useState<string | null>(
    null
  );

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const appsContext = useMemo(
    () => buildAppsContextPayload(releases, readmes),
    [releases, readmes]
  );

  useEffect(() => {
    if (isOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, errorMsg, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const sendMessageToAssistant = async (
    textToSend: string,
    baseHistory: ChatMessage[]
  ) => {
    setIsSending(true);
    setErrorMsg(null);
    setFailedMessageText(null);

    try {
      const conversationPayload = baseHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const data = await sendFirebaseAiChat(conversationPayload, appsContext);

      const assistantReply: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
      };

      setMessages((prev) => [...prev, assistantReply]);
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'تعذّر الاتصال بالمساعد حالياً. تحقق من الشبكة وأعد المحاولة.';
      setErrorMsg(msg);
      setFailedMessageText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputValue('');

    await sendMessageToAssistant(trimmed, nextHistory);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSend(inputValue);
  };

  const handleRetryLast = () => {
    if (!failedMessageText || isSending) {
      return;
    }
    void sendMessageToAssistant(failedMessageText, messages);
  };

  const handleResetChat = () => {
    if (isSending) {
      return;
    }
    setMessages([WELCOME_MESSAGE]);
    setErrorMsg(null);
    setFailedMessageText(null);
    setInputValue('');
  };

  const showQuickSuggestions = messages.length <= 1 && !isSending;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="افتح نافذة مساعد المنصة"
          className="cyber-btn-primary fixed bottom-4 left-4 z-50 min-h-[48px] px-4 sm:px-5 py-2.5 rounded-xl font-display font-bold text-sm inline-flex items-center gap-2.5 whitespace-nowrap"
        >
          <MessageSquareText className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>اسأل المساعد</span>
        </button>
      )}

      {isOpen && (
        <section
          role="dialog"
          aria-label="مساعد منصة عرض تطبيقات المطور أبو معاذ"
          dir="rtl"
          className="fixed bottom-3 left-3 right-3 sm:right-auto sm:bottom-4 sm:left-4 z-50 sm:w-[420px] h-[min(82vh,620px)] flex flex-col rounded-2xl border border-sky-400/40 bg-[#050d20]/98 shadow-[0_12px_48px_-8px_rgba(0,180,255,0.4)] overflow-hidden backdrop-blur-md"
        >
          <div
            className="absolute top-0 inset-x-0 h-[1px] cyber-glow-line"
            aria-hidden="true"
          />

          <header className="px-4 py-3 border-b border-sky-400/20 bg-[#07122b] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#0a1d42] border border-sky-400/35 flex items-center justify-center shrink-0">
                <MessageSquareText
                  className="w-4 h-4 text-[#00b4ff]"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
                  مساعد منصة أبو معاذ
                </h2>
                <p className="text-[11px] text-sky-300/85 truncate">
                  إرشاد التطبيقات والإصدارات الحية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  disabled={isSending}
                  aria-label="بدء محادثة جديدة"
                  title="محادثة جديدة"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-[#0d1f47] transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق نافذة المساعد"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-[#0d1f47] transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 cyber-grid-fine">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isUser
                        ? 'bg-[#00b4ff] text-[#030712] font-medium'
                        : 'bg-[#091632] border border-sky-400/25 text-slate-100'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {showQuickSuggestions && (
              <div className="pt-1 space-y-2">
                <p className="text-xs text-slate-400 font-medium">
                  أسئلة سريعة مقترحة:
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void handleSend(suggestion)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#081530] border border-sky-400/30 hover:border-[#00b4ff] text-sky-200 hover:text-white text-xs sm:text-[13px] font-medium text-right transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSending && (
              <div className="flex justify-end">
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl px-3.5 py-2.5 bg-[#091632] border border-sky-400/25 text-sky-200 text-xs sm:text-sm inline-flex items-center gap-2"
                >
                  <RotateCw
                    className="w-3.5 h-3.5 text-[#00b4ff] animate-spin shrink-0"
                    aria-hidden="true"
                  />
                  <span>جاري كتابة الرد...</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl p-3.5 bg-amber-950/50 border border-amber-400/40 text-amber-100 space-y-2.5"
              >
                <div className="flex items-start gap-2 text-xs sm:text-sm">
                  <AlertTriangle
                    className="w-4 h-4 text-amber-300 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{errorMsg}</span>
                </div>
                {failedMessageText && (
                  <button
                    type="button"
                    onClick={handleRetryLast}
                    disabled={isSending}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 hover:bg-amber-300 transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إعادة المحاولة</span>
                  </button>
                )}
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          <div className="border-t border-sky-400/20 bg-[#060f24] p-3 space-y-2 shrink-0">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <label htmlFor="gemini-chat-input" className="sr-only">
                اكتب سؤالك هنا
              </label>
              <input
                ref={inputRef}
                id="gemini-chat-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isSending}
                placeholder="اكتب سؤالك عن التطبيقات أو الإصدارات..."
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#091632] border border-sky-400/25 text-white placeholder:text-slate-400 text-sm focus:border-[#00b4ff] focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSending || !inputValue.trim()}
                aria-label="إرسال الرسالة"
                className="cyber-btn-primary min-w-[44px] min-h-[44px] px-3.5 rounded-xl flex items-center justify-center disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>

            <p className="text-[11px] text-slate-400 text-center leading-snug">
              تنبيه: قد يخطئ المساعد أحياناً، تحقّق من صفحة التطبيق و GitHub
            </p>
          </div>
        </section>
      )}
    </>
  );
}
