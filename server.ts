import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

const ALLOWED_REPOS = new Set([
  'muslim-assistant',
  'phone-agent',
  'abu-jrin-market',
  '-Vibe-coding',
  '-AW',
  'adhan-reminder',
]);

interface ClientChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AppContextSnapshot {
  repo: string;
  name: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  githubUrl: string;
  status: 'loading' | 'ready' | 'not_found' | 'error';
  tagName: string | null;
  publishedAt: string | null;
  formattedDate: string | null;
  releaseBody: string | null;
  apkUrl: string | null;
  isNew: boolean;
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLen);
}

function formatLiveAppsContext(appsContext: AppContextSnapshot[]): string {
  if (appsContext.length === 0) {
    return 'لا تتوفر بيانات تطبيقات مرسلة حالياً.';
  }

  return appsContext
    .map((item, idx) => {
      const featuresText =
        item.features.length > 0
          ? item.features.map((f) => `  - ${f}`).join('\n')
          : '  - غير محددة';

      let releaseSection = 'حالة الإصدار على GitHub: قريباً (لا يوجد إصدار منشور بعد).';
      if (item.status === 'loading') {
        releaseSection = 'حالة الإصدار على GitHub: جاري الجلب حالياً.';
      } else if (item.status === 'error') {
        releaseSection = 'حالة الإصدار على GitHub: تعذر جلب بيانات الإصدار حالياً من GitHub.';
      } else if (item.status === 'ready' && item.tagName) {
        const lines = [
          `رقم الإصدار (tag_name): ${item.tagName}`,
          item.formattedDate
            ? `تاريخ النشر: ${item.formattedDate} (${item.publishedAt || ''})`
            : item.publishedAt
            ? `تاريخ النشر: ${item.publishedAt}`
            : 'تاريخ النشر: غير محدد',
          `شارة جديد (خلال آخر 7 أيام): ${item.isNew ? 'نعم' : 'لا'}`,
          item.apkUrl
            ? `رابط تحميل APK المباشر: ${item.apkUrl}`
            : 'رابط تحميل APK المباشر: غير مرفق في هذا الإصدار (حالة الزر: قريباً)',
          item.releaseBody
            ? `ملاحظات التغيير من GitHub:\n${item.releaseBody}`
            : 'ملاحظات التغيير من GitHub: لا توجد ملاحظات تغيير مرفقة.',
        ];
        releaseSection = lines.join('\n');
      }

      return [
        `### ${idx + 1}. ${item.name} (${item.repo})`,
        `- التصنيف: ${item.category}`,
        `- الوصف المختصر: ${item.shortDescription}`,
        `- الوصف الكامل: ${item.fullDescription}`,
        `- رابط المستودع على GitHub: ${item.githubUrl}`,
        `- المزايا العامة:\n${featuresText}`,
        releaseSection,
      ].join('\n');
    })
    .join('\n\n');
}

function buildSystemInstruction(appsContext: AppContextSnapshot[]): string {
  const liveDataBlock = formatLiveAppsContext(appsContext);

  return `أنت المساعد الرسمي لزوار «منصة عرض تطبيقات المطور أبو معاذ» (حساب GitHub: Ali-awwww).
مهمتك مساعدة زوار الموقع باللغة العربية الفصحى الواضحة والودودة والمختصرة.

المهام المسموح لك بها:
1. ترشيح التطبيق المناسب حسب حاجة الزائر وفق التوجيه التالي:
   - القرآن الكريم والأذكار ومواقيت الصلاة والأدعية ← «مساعد المسلم» (muslim-assistant)
   - التذكير بمواقيت الأذان والصلاة ← «مذكر الأذان» (adhan-reminder)
   - السوق المحلي لأهالي قرية أبو جرين لعرض المنتجات والبيع والشراء ← «سوق قرية أبو جرين» (abu-jrin-market)
   - المساعد الذكي لإدارة الهاتف وإنجاز المهام ← «وكيل الهاتف» (phone-agent)
   - بيئة البرمجة بأسلوب Vibe Coding لبناء التطبيقات بالوصف ← «فيب كودينغ» (-Vibe-coding)
   - تطبيق أدوات المطور أبو معاذ ← «AW» (-AW)
2. شرح مزايا كل تطبيق استناداً فقط إلى الوصف والمزايا المذكورة في البيانات الحية أدناه.
3. شرح خطوات التحميل والتثبيت لأجهزة أندرويد عند الطلب:
   - الضغط على زر «تحميل APK» في بطاقة التطبيق بالصفحة الرئيسية أو في صفحة تفاصيل التطبيق (أو مسح رمز QR من صفحة التفاصيل عند توفر ملف APK).
   - بعد اكتمال التحميل، فتح ملف APK على الهاتف.
   - السماح بالتثبيت من مصادر غير معروفة / هذا المصدر إذا طلب نظام الهاتف ذلك.
   - إتمام التثبيت ثم فتح التطبيق.
4. الإجابة عن أسئلة الزوار حول آخر الإصدارات وتواريخها وملاحظات التغيير بالاعتماد حصرياً على البيانات الحية أدناه.

القواعد الصارمة (يجب الالتزام بها حرفياً دون أي استثناء):
- لا تُجِب إلا عن تطبيقات المطور أبو معاذ الستة المذكورة أدناه فقط، ولا تُجِب عن مواضيع عامة أو تطبيقات أو موضوعات خارج هذه المنصة. إذا سألك الزائر عن موضوع خارج تطبيقات المطور الستة، اعتذر بلطف ووضّح أن دورك يقتصر على مساعدة زوار منصة تطبيقات المطور أبو معاذ.
- التزم التزاماً تاماً بالبيانات الحية المرفقة أدناه فقط. يُمنع منعاً باتاً اختراع أو تخمين أي مزايا إضافية، أو أرقام إصدارات، أو تواريخ، أو روابط، أو أسعار، أو أحجام ملفات، أو دعم العمل دون إنترنت، أو أذونات، أو لقطات شاشة، أو أي معلومة غير موجودة نصاً في البيانات أدناه.
- إذا كان التطبيق حالته «قريباً» أو بلا إصدار منشور على GitHub، اذكر بوضوح أنه «قريباً» ولا يوجد له إصدار منشور بعد، ولا تخترع أي رقم إصدار.
- إذا سألك الزائر عن معلومة غير موجودة في البيانات المرفقة (مثل: هل التطبيقات مجانية أم مدفوعة؟ أو هل تعمل دون إنترنت؟ أو متى موعد صدور تطبيق حالته قريباً؟ أو تفاصيل تقنية غير مذكورة)، قل بصراحة: «لا أعرف، لا توجد معلومات عن ذلك في بيانات المنصة ومستودعات GitHub الحالية» واقترح عليه مراجعة صفحة التطبيق داخل المنصة أو زيارة مستودع التطبيق على GitHub.

البيانات الحية الحالية للتطبيقات الستة (من src/data/apps.ts و GitHub API):
${liveDataBlock}`;
}

function extractErrorDetails(err: unknown): {
  status: number | null;
  message: string;
} {
  if (!err || typeof err !== 'object') {
    return { status: null, message: String(err ?? 'Unknown error') };
  }
  const maybeErr = err as { status?: unknown; code?: unknown; message?: unknown };
  const status =
    typeof maybeErr.status === 'number'
      ? maybeErr.status
      : typeof maybeErr.code === 'number'
      ? maybeErr.code
      : null;
  const message =
    typeof maybeErr.message === 'string'
      ? maybeErr.message
      : JSON.stringify(err);
  return { status, message };
}

function isModelNotFoundError(err: unknown): boolean {
  const { status, message } = extractErrorDetails(err);
  if (status === 404) {
    return true;
  }
  const msg = message.toLowerCase();
  return (
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('is not supported') ||
    msg.includes('unknown model') ||
    msg.includes('does not exist')
  );
}

function isHighDemandError(err: unknown): boolean {
  const { status, message } = extractErrorDetails(err);
  if (status === 503 || status === 429) {
    return true;
  }
  const msg = message.toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateChatReply(
  ai: GoogleGenAI,
  model: string,
  systemInstruction: string,
  messages: ClientChatMessage[]
): Promise<string> {
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.text }],
  }));

  const latestMessage = messages[messages.length - 1];

  const chat = ai.chats.create({
    model,
    history,
    config: {
      systemInstruction,
    },
  });

  const response = await chat.sendMessage({
    message: latestMessage.text,
  });

  const replyText = (response.text || '').trim();
  if (!replyText) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }
  return replyText;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.post('/api/chat', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'خدمة المساعد غير متاحة حالياً لعدم توفر تهيئة Gemini على الخادم.',
      });
      return;
    }

    const body = req.body as {
      messages?: unknown;
      appsContext?: unknown;
    };

    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      res.status(400).json({ error: 'يرجى إرسال نص الرسالة بشكل صحيح.' });
      return;
    }

    const sanitizedMessages: ClientChatMessage[] = body.messages
      .slice(-20)
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const m = item as { role?: unknown; text?: unknown };
        const role =
          m.role === 'assistant'
            ? ('assistant' as const)
            : m.role === 'user'
            ? ('user' as const)
            : null;
        const text = sanitizeText(m.text, 2000);
        if (!role || !text) {
          return null;
        }
        return { role, text };
      })
      .filter((m): m is ClientChatMessage => m !== null);

    if (
      sanitizedMessages.length === 0 ||
      sanitizedMessages[sanitizedMessages.length - 1].role !== 'user'
    ) {
      res.status(400).json({ error: 'يجب أن تنتهي المحادثة برسالة من المستخدم.' });
      return;
    }

    const rawContext = Array.isArray(body?.appsContext) ? body.appsContext : [];
    const sanitizedContext: AppContextSnapshot[] = rawContext
      .slice(0, 10)
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const c = item as Record<string, unknown>;
        const repo = sanitizeText(c.repo, 80);
        if (!ALLOWED_REPOS.has(repo)) {
          return null;
        }
        const statusRaw = c.status;
        const status: AppContextSnapshot['status'] =
          statusRaw === 'ready' ||
          statusRaw === 'not_found' ||
          statusRaw === 'loading' ||
          statusRaw === 'error'
            ? statusRaw
            : 'not_found';

        const features = Array.isArray(c.features)
          ? c.features
              .slice(0, 10)
              .map((f) => sanitizeText(f, 250))
              .filter(Boolean)
          : [];

        return {
          repo,
          name: sanitizeText(c.name, 120),
          category: sanitizeText(c.category, 60),
          shortDescription: sanitizeText(c.shortDescription, 400),
          fullDescription: sanitizeText(c.fullDescription, 1000),
          features,
          githubUrl: `https://github.com/Ali-awwww/${repo}`,
          status,
          tagName: c.tagName ? sanitizeText(c.tagName, 100) : null,
          publishedAt: c.publishedAt ? sanitizeText(c.publishedAt, 80) : null,
          formattedDate: c.formattedDate ? sanitizeText(c.formattedDate, 100) : null,
          releaseBody: c.releaseBody ? sanitizeText(c.releaseBody, 2500) : null,
          apkUrl:
            typeof c.apkUrl === 'string' && c.apkUrl.startsWith('https://')
              ? c.apkUrl.slice(0, 500)
              : null,
          isNew: Boolean(c.isNew),
        };
      })
      .filter((item): item is AppContextSnapshot => item !== null);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = buildSystemInstruction(sanitizedContext);

    try {
      const activeModels: string[] = [...MODEL_FALLBACK_CHAIN];
      const unavailableModels = new Set<string>();
      let lastError: unknown = null;
      let sawHighDemand = false;

      for (let round = 0; round <= RETRY_DELAYS_MS.length; round++) {
        if (round > 0) {
          const delayMs = RETRY_DELAYS_MS[round - 1];
          console.info(
            `[Gemini Chat] Waiting ${delayMs}ms before retry round ${round}/${RETRY_DELAYS_MS.length}...`
          );
          await sleep(delayMs);
        }

        let roundTriedAny = false;

        for (const model of activeModels) {
          if (unavailableModels.has(model)) {
            continue;
          }
          roundTriedAny = true;

          try {
            const reply = await generateChatReply(
              ai,
              model,
              systemInstruction,
              sanitizedMessages
            );
            console.info(
              `[Gemini Chat] Success with model "${model}" (round ${round}).`
            );
            res.json({ reply, model });
            return;
          } catch (err) {
            lastError = err;
            const { status, message } = extractErrorDetails(err);

            if (isModelNotFoundError(err)) {
              unavailableModels.add(model);
              console.warn(
                `[Gemini Chat] Model "${model}" failed (404/not found, status=${status ?? 'n/a'}): ${message}`
              );
              continue;
            }

            if (isHighDemandError(err)) {
              sawHighDemand = true;
              console.warn(
                `[Gemini Chat] Model "${model}" failed due to 503/high demand (round ${round}, status=${status ?? 'n/a'}): ${message}`
              );
              continue;
            }

            console.error(
              `[Gemini Chat] Model "${model}" failed with non-retryable error (status=${status ?? 'n/a'}): ${message}`
            );
            throw err;
          }
        }

        if (!roundTriedAny || !sawHighDemand) {
          break;
        }
      }

      if (sawHighDemand) {
        res.status(503).json({
          error:
            'المساعد مشغول مؤقتاً بسبب الضغط المرتفع على خدمة Gemini حالياً. يمكنك إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات مباشرة.',
        });
        return;
      }

      console.error('[Gemini Chat] All models failed:', lastError);
      res.status(502).json({
        error:
          'المساعد غير متاح مؤقتاً لتعذّر الوصول إلى نماذج Gemini. يرجى إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات.',
      });
    } catch (err) {
      const { status, message } = extractErrorDetails(err);
      console.error(
        `[Gemini Chat] Unhandled error (status=${status ?? 'n/a'}): ${message}`
      );
      if (isHighDemandError(err)) {
        res.status(503).json({
          error:
            'المساعد مشغول مؤقتاً بسبب الضغط المرتفع على خدمة Gemini حالياً. يمكنك إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات مباشرة.',
        });
        return;
      }
      res.status(502).json({
        error: 'تعذّر الاتصال بمساعد Gemini حالياً. يرجى المحاولة مرة أخرى.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
