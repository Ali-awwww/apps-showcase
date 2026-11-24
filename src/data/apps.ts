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
  },
  {
    repo: 'phone-agent',
    name: 'وكيل الهاتف',
    category: 'أدوات',
    iconId: 'phone-agent',
  },
  {
    repo: 'abu-jrin-market',
    name: 'سوق قرية أبو جرين',
    category: 'تسوق',
    iconId: 'abu-jrin-market',
  },
  {
    repo: '-Vibe-coding',
    name: 'فيب كودينغ',
    category: 'تطوير',
    iconId: '-Vibe-coding',
  },
  {
    repo: '-AW',
    name: 'AW',
    category: 'أدوات',
    iconId: '-AW',
  },
  {
    repo: 'adhan-reminder',
    name: 'مذكر الأذان',
    category: 'إسلامي',
    iconId: 'adhan-reminder',
  },
];

export function getRepoGithubUrl(repo: string): string {
  return `${GITHUB_PROFILE_URL}/${repo}`;
}
