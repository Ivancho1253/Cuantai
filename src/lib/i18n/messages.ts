import english from './en.json';
import portuguese from './pt.json';
export const translations: Record<'en' | 'pt', Record<string, string>> = {
  en: english,
  pt: portuguese,
};
