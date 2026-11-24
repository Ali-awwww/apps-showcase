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
  githubUrl: string;
  readmeStatus: 'loading' | 'ready' | 'not_found' | 'error';
  readmeExists: boolean;
  readmeUrl: string | null;
  readmeDescription: string | null;
  readmeFeatures: string[];
  readmeInstallUsage: string | null;
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
      let readmeSection = 'ملف README.md على GitHub: غير موجود (قريباً — لا تتوفر تفاصيل في المستودع بعد).';
      if (item.readmeStatus === 'loading') {
        readmeSection = 'ملف README.md على GitHub: جاري الجلب حالياً.';
      } else if (item.readmeStatus === 'error') {
        readmeSection = 'ملف README.md على GitHub: تعذر جلبه حالياً.';
      } else if (item.readmeExists) {
        const featuresText =
          item.readmeFeatures.length > 0
            ? item.readmeFeatures.map((f) => `  - ${f}`).join('\n')
            : '  - غير مذكور في README';
        const readmeLines = [
          `رابط ملف README على GitHub: ${item.readmeUrl || item.githubUrl}`,
          `الوصف من README: ${item.readmeDescription || 'غير مذكور في README'}`,
          `المزايا من README:\n${featuresText}`,
          `التثبيت والاستخدام من README: ${item.readmeInstallUsage || 'غير مذكور في README'}`,
        ];
        readmeSection = readmeLines.join('\n');
      }

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
        `- رابط المستودع على GitHub: ${item.githubUrl}`,
        readmeSection,
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
1. ترشيح التطبيق المناسب حسب حاجة الزائر بالاعتماد حصرياً على اسم التطبيق وتصنيفه وما ورد في ملف README.md الخاص به في البيانات الحية أدناه.
2. شرح وصف التطبيق ومزاياه وطريقة تثبيته واستخدامه استناداً فقط إلى ما ورد فعلياً في ملف README.md وبيانات GitHub المرفقة أدناه.
3. شرح خطوات تحميل وتثبيت ملف APK لأجهزة أندرويد عند توفر رابط APK حقيقي:
   - الضغط على زر «تحميل APK» في بطاقة التطبيق بالصفحة الرئيسية أو في صفحة تفاصيل التطبيق (أو مسح رمز QR من صفحة التفاصيل عند توفر ملف APK).
   - بعد اكتمال التحميل، فتح ملف APK على الهاتف.
   - السماح بالتثبيت من مصادر غير معروفة / هذا المصدر إذا طلب نظام الهاتف ذلك.
   - إتمام التثبيت ثم فتح التطبيق.
4. الإجابة عن أسئلة الزوار حول آخر الإصدارات وتواريخها وملاحظات التغيير بالاعتماد حصرياً على البيانات الحية أدناه.

القواعد الصارمة (يجب الالتزام بها حرفياً دون أي استثناء):
- لا تُجِب إلا عن تطبيقات المطور أبو معاذ الستة المذكورة أدناه فقط، ولا تُجِب عن مواضيع عامة أو تطبيقات أو موضوعات خارج هذه المنصة. إذا سألك الزائر عن موضوع خارج تطبيقات المطور الستة، اعتذر بلطف ووضّح أن دورك يقتصر على مساعدة زوار منصة تطبيقات المطور أبو معاذ.
- التزم التزاماً تاماً بالبيانات الحية المرفقة أدناه فقط. يُمنع منعاً باتاً اختراع أو تخمين أي مزايا إضافية، أو أوصاف، أو أرقام إصدارات، أو تواريخ، أو روابط، أو أسعار، أو أحجام ملفات، أو دعم العمل دون إنترنت، أو أذونات، أو لقطات شاشة، أو أي معلومة غير موجودة نصاً في البيانات أدناه.
- إذا كان التطبيق بلا ملف README (مثال: «فيب كودينغ» -Vibe-coding) أو بلا إصدار منشور على GitHub، اذكر بوضوح أنه «قريباً» ولا تخترع له أي وصف أو مزايا أو رقم إصدار.
- إذا كان أحد الأقسام في README (مثل المزايا أو التثبيت والاستخدام) «غير مذكور في README»، أخبر الزائر بذلك صراحة ولا تخترع له محتوى.
- إذا سألك الزائر عن معلومة غير موجودة في البيانات المرفقة (مثل: هل التطبيقات مجانية أم مدفوعة؟ أو هل تعمل دون إنترنت؟ أو متى موعد صدور تطبيق حالته قريباً؟ أو تفاصيل تقنية غير مذكورة)، قل بصراحة: «لا أعرف، لا توجد معلومات عن ذلك في بيانات المنصة ومستودعات GitHub الحالية» واقترح عليه مراجعة صفحة التطبيق داخل المنصة أو زيارة مستودع التطبيق على GitHub.

البيانات الحية الحالية للتطبيقات الستة (من ملفات README.md و GitHub Releases API):
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

        const readmeStatusRaw = c.readmeStatus;
        const readmeStatus: AppContextSnapshot['readmeStatus'] =
          readmeStatusRaw === 'ready' ||
          readmeStatusRaw === 'not_found' ||
          readmeStatusRaw === 'loading' ||
          readmeStatusRaw === 'error'
            ? readmeStatusRaw
            : 'not_found';

        const readmeFeatures = Array.isArray(c.readmeFeatures)
          ? c.readmeFeatures
              .slice(0, 20)
              .map((f) => sanitizeText(f, 300))
              .filter(Boolean)
          : [];

        return {
          repo,
          name: sanitizeText(c.name, 120),
          category: sanitizeText(c.category, 60),
          githubUrl: `https://github.com/Ali-awwww/${repo}`,
          readmeStatus,
          readmeExists: Boolean(c.readmeExists),
          readmeUrl:
            typeof c.readmeUrl === 'string' && c.readmeUrl.startsWith('https://')
              ? c.readmeUrl.slice(0, 500)
              : null,
          readmeDescription: c.readmeDescription
            ? sanitizeText(c.readmeDescription, 1200)
            : null,
          readmeFeatures,
          readmeInstallUsage: c.readmeInstallUsage
            ? sanitizeText(c.readmeInstallUsage, 2500)
            : null,
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
