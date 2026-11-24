import { AIError, AIErrorCode, Content, getGenerativeModel } from 'firebase/ai';
import { firebaseAI } from '../lib/firebase';
import { AppContextPayload } from './chatContext';

export interface ClientChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
] as const;

const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

function formatLiveAppsContext(appsContext: AppContextPayload[]): string {
  if (appsContext.length === 0) {
    return 'لا تتوفر بيانات تطبيقات مرسلة حالياً.';
  }

  return appsContext
    .map((item, idx) => {
      let readmeSection =
        'ملف README.md على GitHub: غير موجود (قريباً — لا تتوفر تفاصيل في المستودع بعد).';
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
          `التثبيت والاستخدام من README: ${
            item.readmeInstallUsage || 'غير مذكور في README'
          }`,
        ];
        readmeSection = readmeLines.join('\n');
      }

      let releaseSection =
        'حالة الإصدار على GitHub: قريباً (لا يوجد إصدار منشور بعد).';
      if (item.status === 'loading') {
        releaseSection = 'حالة الإصدار على GitHub: جاري الجلب حالياً.';
      } else if (item.status === 'error') {
        releaseSection =
          'حالة الإصدار على GitHub: تعذر جلب بيانات الإصدار حالياً من GitHub.';
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

function buildSystemInstruction(appsContext: AppContextPayload[]): string {
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
- إذا كان التطبيق بلا ملف README أو بلا إصدار منشور على GitHub، اذكر بوضوح أنه «قريباً» ولا تخترع له أي وصف أو مزايا أو رقم إصدار.
- إذا كان أحد الأقسام في README (مثل المزايا أو التثبيت والاستخدام) «غير مذكور في README»، أخبر الزائر بذلك صراحة ولا تخترع له محتوى.
- إذا سألك الزائر عن معلومة غير موجودة في البيانات المرفقة (مثل: هل التطبيقات مجانية أم مدفوعة؟ أو هل تعمل دون إنترنت؟ أو متى موعد صدور تطبيق حالته قريباً؟ أو تفاصيل تقنية غير مذكورة)، قل بصراحة: «لا أعرف، لا توجد معلومات عن ذلك في بيانات المنصة ومستودعات GitHub الحالية» واقترح عليه مراجعة صفحة التطبيق داخل المنصة أو زيارة مستودع التطبيق على GitHub.

البيانات الحية الحالية للتطبيقات الستة (من ملفات README.md و GitHub Releases API):
${liveDataBlock}`;
}

function extractAiErrorInfo(err: unknown): {
  status: number | null;
  code: string | null;
  message: string;
} {
  if (err instanceof AIError) {
    const status =
      typeof err.customErrorData?.status === 'number'
        ? err.customErrorData.status
        : null;
    return {
      status,
      code: err.code,
      message: err.message,
    };
  }
  if (err instanceof Error) {
    return { status: null, code: null, message: err.message };
  }
  return { status: null, code: null, message: String(err ?? 'Unknown error') };
}

function isModelNotFoundError(err: unknown): boolean {
  const { status, message } = extractAiErrorInfo(err);
  if (status === 404) {
    return true;
  }
  const msg = message.toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('is not supported') ||
    msg.includes('unknown model') ||
    msg.includes('no longer available')
  );
}

function isHighDemandError(err: unknown): boolean {
  const { status, message } = extractAiErrorInfo(err);
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

async function generateReplyWithModel(
  modelName: string,
  systemInstruction: string,
  messages: ClientChatMessage[]
): Promise<string> {
  const generativeModel = getGenerativeModel(firebaseAI, {
    model: modelName,
    systemInstruction,
  });

  const history: Content[] = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ type: 'text', text: m.text }],
  }));

  const latestMessage = messages[messages.length - 1];
  const chat = generativeModel.startChat({ history });
  const result = await chat.sendMessage(latestMessage.text);
  const replyText = result.response.text().trim();

  if (!replyText) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }
  return replyText;
}

export async function sendFirebaseAiChat(
  messages: ClientChatMessage[],
  appsContext: AppContextPayload[]
): Promise<{ reply: string; model: string }> {
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    throw new Error('يرجى كتابة سؤال أولاً قبل الإرسال.');
  }

  const systemInstruction = buildSystemInstruction(appsContext);
  const unavailableModels = new Set<string>();
  let sawHighDemand = false;
  let lastError: unknown = null;

  for (let round = 0; round <= RETRY_DELAYS_MS.length; round++) {
    if (round > 0) {
      const delayMs = RETRY_DELAYS_MS[round - 1];
      console.info(
        `[Firebase AI Chat] Waiting ${delayMs}ms before retry round ${round}/${RETRY_DELAYS_MS.length}...`
      );
      await sleep(delayMs);
    }

    let roundTriedAny = false;

    for (const modelName of MODEL_FALLBACK_CHAIN) {
      if (unavailableModels.has(modelName)) {
        continue;
      }
      roundTriedAny = true;

      try {
        const reply = await generateReplyWithModel(
          modelName,
          systemInstruction,
          messages
        );
        console.info(
          `[Firebase AI Chat] Success with model "${modelName}" (round ${round}).`
        );
        return { reply, model: modelName };
      } catch (err) {
        lastError = err;
        const { status, code, message } = extractAiErrorInfo(err);

        if (code === AIErrorCode.API_NOT_ENABLED) {
          console.error(
            `[Firebase AI Chat] Firebase AI Logic API is not enabled: ${message}`
          );
          throw new Error(
            'لم يتم تفعيل خدمة Firebase AI Logic في لوحة Firebase لمشروع apps-showcase-a8f91 بعد.'
          );
        }

        if (isModelNotFoundError(err)) {
          unavailableModels.add(modelName);
          console.warn(
            `[Firebase AI Chat] Model "${modelName}" failed (404/not found, status=${status ?? 'n/a'}): ${message}`
          );
          continue;
        }

        if (isHighDemandError(err)) {
          sawHighDemand = true;
          console.warn(
            `[Firebase AI Chat] Model "${modelName}" failed due to 503/high demand (round ${round}, status=${status ?? 'n/a'}): ${message}`
          );
          continue;
        }

        console.error(
          `[Firebase AI Chat] Model "${modelName}" failed (status=${status ?? 'n/a'}, code=${code ?? 'n/a'}): ${message}`
        );
        throw new Error(
          'تعذّر الاتصال بمساعد Gemini عبر Firebase AI Logic حالياً. يرجى المحاولة مرة أخرى.'
        );
      }
    }

    if (!roundTriedAny || !sawHighDemand) {
      break;
    }
  }

  if (sawHighDemand) {
    throw new Error(
      'المساعد مشغول مؤقتاً بسبب الضغط المرتفع على خدمة Gemini حالياً. يمكنك إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات مباشرة.'
    );
  }

  console.error('[Firebase AI Chat] All fallback models failed:', lastError);
  throw new Error(
    'المساعد غير متاح مؤقتاً لتعذّر الوصول إلى نماذج Gemini. يرجى إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات.'
  );
}
