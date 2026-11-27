export interface TutorialStep {
  title: string;
  text: string;
}

export interface TutorialLink {
  label: string;
  url: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  inviteCodes?: string[];
  links: TutorialLink[];
  note?: string;
  video?: string;
}

export const TUTORIALS: Tutorial[] = [
  {
    id: 'muse-from-egypt',
    title: 'كيف تستخدم موس من مصر',
    description:
      'موس غير متاح رسميًا في مصر، لكن يمكنك استخدامه بخطوات بسيطة: VPN مجاني على أمريكا، ثم تحميل التطبيق، ثم إنشاء حساب، ثم إدخال كود الدعوة.',
    steps: [
      {
        title: 'لماذا لا يعمل موس في مصر؟',
        text: 'موس متاح رسميًا في 7 دول فقط: أمريكا، كندا، اليابان، سنغافورة، المكسيك، أستراليا، بريطانيا. مصر ليست منها، لذلك لا يظهر التطبيق في المتجر ولا يفتح الموقع. الحل: VPN على دولة مدعومة.',
      },
      {
        title: 'ثبّت VPN مجاني واختر أمريكا',
        text: 'نزّل Proton VPN المجاني — لا يحتاج بطاقة. افتحه واختر سيرفر أمريكا وشغّله، وأبقه مشغلًا أثناء استخدام موس.',
      },
      {
        title: 'حمّل تطبيق موس',
        text: 'أثناء تشغيل الـ VPN، حمّل التطبيق من Google Play أو App Store، أو افتح muse.ai من المتصفح.',
      },
      {
        title: 'أنشئ حسابًا جديدًا',
        text: 'سجّل حسابًا جديدًا في موس بالإيميل، وأكمل خطوات التحقق.',
      },
      {
        title: 'أدخل كود الدعوة خلال 48 ساعة',
        text: 'بعد إنشاء الحساب، أدخل الكود MGFX96 خلال 48 ساعة. تحصل على مليار رمز، ويحصل صاحب الكود على مليار رمز أيضًا.',
      },
    ],
    inviteCodes: ['MGFX96', 'JW6TN8'],
    video: '/muse-from-egypt.mp4',
    links: [
      {
        label: 'تحميل من Google Play',
        url: 'https://play.google.com/store/apps/details?id=com.facebook.aura',
      },
      {
        label: 'تحميل من App Store',
        url: 'https://apps.apple.com/us/app/muse-from-meta/id6760173601',
      },
      {
        label: 'افتح muse.ai',
        url: 'https://muse.ai',
      },
      {
        label: 'تحميل Proton VPN مباشرة (APK)',
        url: 'https://liteapks.com/download/proton-vpn-837621',
      },
    ],
  },
];
