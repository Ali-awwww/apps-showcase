const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.8-flash',
] as const;

// Daily per-visitor question quota, enforced with the same KV namespace
// as the visitor counter (binding VISITS_KV). IPv6 visitors are counted
// per /64 prefix (see normalizeClientIp). Fail-open: if KV or the client
// IP is unavailable, the question is answered without counting.
const DAILY_QUESTIONS_PER_VISITOR = 20;
const RATE_LIMIT_TTL_SECONDS = 24 * 60 * 60;

function getClientIp(request: Request | undefined): string {
  const headers = request?.headers;
  if (!headers) {
    return '';
  }
  const direct = (headers.get('cf-connecting-ip') || '').trim();
  if (direct) {
    return direct;
  }
  const forwarded = (headers.get('x-forwarded-for') || '').trim();
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? '';
  }
  return '';
}

function normalizeClientIp(ip: string): string {
  const trimmed = ip.trim();
  if (!trimmed.includes(':')) {
    return trimmed; // IPv4: count per address.
  }
  // IPv6: count per /64 network prefix (first 4 groups). One visitor's
  // privacy-extension addresses rotate within the same /64, while different
  // visitors are (almost always) on different /64s — so per-address
  // counting would never trigger for IPv6 visitors.
  const head = trimmed.split('::')[0] ?? '';
  const groups = head.split(':').filter((g) => g.length > 0);
  if (groups.length >= 4) {
    return `${groups.slice(0, 4).join(':')}::/64`;
  }
  return trimmed;
}

async function checkDailyQuestionQuota(
  kv: any,
  request: Request | undefined
): Promise<{ allowed: boolean }> {
  try {
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      return { allowed: true };
    }
    const ip = getClientIp(request);
    if (!ip) {
      return { allowed: true };
    }
    const today = new Date().toISOString().slice(0, 10);
    const key = `rate:${normalizeClientIp(ip)}:${today}`;
    const stored = await kv.get(key);
    const used = stored ? parseInt(stored, 10) || 0 : 0;
    if (used >= DAILY_QUESTIONS_PER_VISITOR) {
      return { allowed: false };
    }
    await kv.put(key, String(used + 1), {
      expirationTtl: RATE_LIMIT_TTL_SECONDS,
    });
    return { allowed: true };
  } catch (err) {
    console.warn('[Gemini Chat] Rate-limit check failed, failing open:', err);
    return { allowed: true };
  }
}

const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
const FETCH_TIMEOUT_MS = 20000;

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

class GeminiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GeminiHttpError';
    this.status = status;
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
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
          `التثبيت والاستخدام من README: ${item.readmeInstallUsage || 'غير مذكور في README'}`,
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

function buildSystemInstruction(appsContext: AppContextSnapshot[]): string {
  const liveDataBlock = formatLiveAppsContext(appsContext);

  return `اسمك «معاذ»، وأنت المساعد الرسمي لزوار «منصة عرض تطبيقات المطور أبو معاذ» (حساب GitHub: Ali-awwww).
مهمتك مساعدة زوار الموقع باللغة العربية الفصحى الواضحة والودودة والمختصرة.

معلومات عن المنصة نفسها (ثابتة، من بنية الموقع — أجب عن أسئلة الزوار حول المنصة اعتماداً عليها):
- المنصة: «منصة عرض تطبيقات المطور أبو معاذ»، تعرض تطبيقات المطور أبو معاذ الستة، وتجلب بيانات كل تطبيق حياً من مستودعه على GitHub (ملف README.md وآخر إصدار Release) عند كل زيارة، فتظهر في البطاقات زر تحميل APK وتاريخ الإصدار وشارة «جديد» للإصدارات المنشورة خلال آخر 7 أيام.
- التطبيقات الستة: «مساعد المسلم» (إسلامي)، «وكيل الهاتف» (أدوات)، «سوق قرية أبو جرين» (تسوق)، «فيب كودينغ» (تطوير)، «AW» (أدوات)، «مذكر الأذان» (إسلامي).
- أقسام الموقع: «التطبيقات» (الصفحة الرئيسية: بطاقات التطبيقات الستة)، «ما الجديد» (صفحة تعرض التطبيقات التي لها إصدار منشور على GitHub مرتبة من الأحدث إلى الأقدم)، وصفحة تفاصيل كل تطبيق (الوصف والمزايا وخطوات التثبيت وزر تحميل APK ورمز QR للتحميل).
- عداد الزوار: عداد إلكتروني حديث تحت اسم المنصة في أعلى الصفحة يعرض إجمالي عدد زيارات الموقع، ويزيد مرة واحدة لكل جلسة متصفح.
- أنت تعمل داخل زر «اسأل المساعد» في الموقع، وتظهر نسخة الموقع على Cloudflare Pages (وهي النسخة الكاملة التي يعمل فيها المساعد).
- أحدث التحديثات: هي أحدث الإصدارات المنشورة على GitHub للتطبيقات الستة، وتظهر مرتبة من الأحدث في صفحة «ما الجديد» وفي البيانات الحية أدناه (تاريخ النشر ورقم الإصدار).

المهام المسموح لك بها:
1. ترشيح التطبيق المناسب حسب حاجة الزائر بالاعتماد حصرياً على اسم التطبيق وتصنيفه وما ورد في ملف README.md الخاص به في البيانات الحية أدناه.
2. شرح وصف التطبيق ومزاياه وطريقة تثبيته واستخدامه استناداً فقط إلى ما ورد فعلياً في ملف README.md وبيانات GitHub المرفقة أدناه.
3. شرح خطوات تحميل وتثبيت ملف APK لأجهزة أندرويد عند توفر رابط APK حقيقي:
   - الضغط على زر «تحميل APK» في بطاقة التطبيق بالصفحة الرئيسية أو في صفحة تفاصيل التطبيق (أو مسح رمز QR من صفحة التفاصيل عند توفر ملف APK).
   - بعد اكتمال التحميل، فتح ملف APK على الهاتف.
   - السماح بالتثبيت من مصادر غير معروفة / هذا المصدر إذا طلب نظام الهاتف ذلك.
   - إتمام التثبيت ثم فتح التطبيق.
4. الإجابة عن أسئلة الزوار حول آخر الإصدارات وتواريخها وملاحظات التغيير بالاعتماد حصرياً على البيانات الحية أدناه.
5. الإجابة عن أسئلة الزوار حول المنصة نفسها وأقسامها وآخر تحديثاتها وعداد الزوار بالاعتماد على معلومات المنصة أعلاه والبيانات الحية أدناه.

القواعد الصارمة (يجب الالتزام بها حرفياً دون أي استثناء):
- إذا سألك الزائر عن اسمك، عرّف بنفسك بأنك «معاذ»، المساعد الرسمي لمنصة عرض تطبيقات المطور أبو معاذ.
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
  if (err instanceof GeminiHttpError) {
    return { status: err.status, message: err.message };
  }
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

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const maybeErr = err as { name?: unknown; message?: unknown };
  const name = typeof maybeErr.name === 'string' ? maybeErr.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') {
    return true;
  }
  const msg =
    typeof maybeErr.message === 'string'
      ? maybeErr.message.toLowerCase()
      : '';
  return msg.includes('timed out') || msg.includes('timeout');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateChatReplyRest(
  apiKey: string,
  model: string,
  systemInstruction: string,
  messages: ClientChatMessage[]
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        // Short, focused answers: keeps replies useful and protects the
        // shared Gemini quota from long generations.
        maxOutputTokens: 600,
      },
      contents,
    }),
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errJson = (await response.json()) as {
        error?: { message?: string; status?: string };
      };
      if (errJson?.error?.message) {
        errorMessage = `${errJson.error.status ? `${errJson.error.status}: ` : ''}${errJson.error.message}`;
      }
    } catch {
      try {
        const textBody = await response.text();
        if (textBody) {
          errorMessage = textBody.slice(0, 400);
        }
      } catch {
        // Ignore body parse failure
      }
    }
    throw new GeminiHttpError(response.status, errorMessage);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const parts = data?.candidates?.[0]?.content?.parts;
  const replyText = Array.isArray(parts)
    ? parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim()
    : '';

  if (!replyText) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }

  return replyText;
}

export async function onRequestPost(context: any): Promise<Response> {
  const apiKey =
    typeof context?.env?.GEMINI_API_KEY === 'string'
      ? context.env.GEMINI_API_KEY.trim()
      : '';

  if (!apiKey) {
    return jsonResponse(
      {
        error:
          'خدمة المساعد غير متاحة حالياً لعدم توفر تهيئة Gemini على الخادم.',
      },
      503
    );
  }

  let body: { messages?: unknown; appsContext?: unknown };
  try {
    body = (await context.request.json()) as {
      messages?: unknown;
      appsContext?: unknown;
    };
  } catch {
    return jsonResponse(
      { error: 'يرجى إرسال نص الرسالة بشكل صحيح.' },
      400
    );
  }

  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return jsonResponse(
      { error: 'يرجى إرسال نص الرسالة بشكل صحيح.' },
      400
    );
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
    return jsonResponse(
      { error: 'يجب أن تنتهي المحادثة برسالة من المستخدم.' },
      400
    );
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
        formattedDate: c.formattedDate
          ? sanitizeText(c.formattedDate, 100)
          : null,
        releaseBody: c.releaseBody ? sanitizeText(c.releaseBody, 2500) : null,
        apkUrl:
          typeof c.apkUrl === 'string' && c.apkUrl.startsWith('https://')
            ? c.apkUrl.slice(0, 500)
            : null,
        isNew: Boolean(c.isNew),
      };
    })
    .filter((item): item is AppContextSnapshot => item !== null);

  // Daily per-visitor quota (20 questions/day/IP, counted in KV). Over the
  // limit, answer with a polite message as a normal reply — not an error —
  // so the chat UI keeps working.
  const quota = await checkDailyQuestionQuota(
    context?.env?.VISITS_KV,
    context?.request
  );
  if (!quota.allowed) {
    return jsonResponse(
      {
        reply:
          'وصلتَ إلى حد الأسئلة اليومي (20 سؤالاً) في منصة أبو معاذ. يمكنك العودة غداً لمتابعة الأسئلة، وشكراً لتفهمك!',
        rateLimited: true,
      },
      200
    );
  }

  const systemInstruction = buildSystemInstruction(sanitizedContext);

  try {
    const activeModels: string[] = [...MODEL_FALLBACK_CHAIN];
    const unavailableModels = new Set<string>();
    let lastError: unknown = null;
    let sawHighDemand = false;
    let sawTimeout = false;

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
          const reply = await generateChatReplyRest(
            apiKey,
            model,
            systemInstruction,
            sanitizedMessages
          );
          console.info(
            `[Gemini Chat] Success with model "${model}" (round ${round}).`
          );
          return jsonResponse({ reply, model }, 200);
        } catch (err) {
          lastError = err;
          const { status, message } = extractErrorDetails(err);

          if (isTimeoutError(err)) {
            sawTimeout = true;
            console.warn(
              `[Gemini Chat] Model "${model}" timed out after ${FETCH_TIMEOUT_MS}ms (round ${round}): ${message}`
            );
            continue;
          }

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

    if (sawHighDemand || sawTimeout) {
      return jsonResponse(
        {
          error:
            'المساعد مشغول مؤقتاً بسبب الضغط المرتفع على خدمة Gemini حالياً. يمكنك إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات مباشرة.',
        },
        503
      );
    }

    console.error('[Gemini Chat] All models failed:', lastError);
    return jsonResponse(
      {
        error:
          'المساعد غير متاح مؤقتاً لتعذّر الوصول إلى نماذج Gemini. يرجى إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات.',
      },
      502
    );
  } catch (err) {
    const { status, message } = extractErrorDetails(err);
    console.error(
      `[Gemini Chat] Unhandled error (status=${status ?? 'n/a'}): ${message}`
    );
    if (isHighDemandError(err)) {
      return jsonResponse(
        {
          error:
            'المساعد مشغول مؤقتاً بسبب الضغط المرتفع على خدمة Gemini حالياً. يمكنك إعادة المحاولة بعد قليل أو تصفح بطاقات التطبيقات مباشرة.',
        },
        503
      );
    }
    return jsonResponse(
      {
        error: 'تعذّر الاتصال بمساعد Gemini حالياً. يرجى المحاولة مرة أخرى.',
      },
      502
    );
  }
}
