import { AppDefinition, FilterCategory } from '../types/app';

export const GITHUB_OWNER = 'Ali-awwww';
export const GITHUB_PROFILE_URL = `https://github.com/${GITHUB_OWNER}`;

export const FILTER_CATEGORIES: FilterCategory[] = [
  'الكل',
  'إسلامي',
  'أدوات',
  'تسوق',
  'تطوير',
];

export const APPS_CATALOG: AppDefinition[] = [
  {
    repo: 'muslim-assistant',
    name: 'مساعد المسلم',
    category: 'إسلامي',
    iconId: 'muslim-assistant',
    androidPackage: 'com.aistudio.qabas.kxmpzq',
    androidScheme: 'muslimassistant',
  },
  {
    repo: 'phone-agent',
    name: 'وكيل الهاتف',
    category: 'أدوات',
    iconId: 'phone-agent',
    androidPackage: 'com.aistudio.phoneagent.wakeel',
    androidScheme: 'phoneagent',
  },
  {
    repo: 'abu-jrin-market',
    name: 'سوق قرية أبو جرين',
    category: 'تسوق',
    iconId: 'abu-jrin-market',
    androidPackage: 'com.abujrin.market',
    androidScheme: 'abujrinmarket',
  },
  {
    repo: '-Vibe-coding',
    name: 'فيب كودينغ',
    category: 'تطوير',
    iconId: '-Vibe-coding',
    androidPackage: 'com.aistudio.crashintelligence.vyfrip',
    androidScheme: 'vibecoding',
  },
  {
    repo: '-AW',
    name: 'AW',
    category: 'أدوات',
    iconId: '-AW',
    androidPackage: 'com.aistudio.awplayer.kxmpzq',
    androidScheme: 'awplayer',
  },
  {
    repo: 'adhan-reminder',
    name: 'مذكر الأذان',
    category: 'إسلامي',
    iconId: 'adhan-reminder',
    androidPackage: 'com.adhanreminder.app',
    androidScheme: 'adhanreminder',
  },
  {
    repo: 'sadiq-al-muslim',
    name: 'صديق المسلم',
    category: 'إسلامي',
    iconId: 'sadiq-al-muslim',
    androidPackage: 'com.sadiqalmuslim.app',
    androidScheme: 'sadiqalmuslim',
  },
  {
    repo: 'sibaq-al-maalumat',
    name: 'سباق المعلومات',
    category: 'إسلامي',
    iconId: 'sibaq-al-maalumat',
    androidPackage: 'com.sibaqalmaalumat.app',
    androidScheme: 'sibaqalmaalumat',
  },
];

export function getRepoGithubUrl(repo: string): string {
  return `${GITHUB_PROFILE_URL}/${repo}`;
}
