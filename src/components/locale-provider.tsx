'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { Languages } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { translations } from '@/lib/i18n/messages';
export type Locale = 'es' | 'en' | 'pt';
export const isLocale = (value: unknown): value is Locale =>
  ['es', 'en', 'pt'].includes(String(value));
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: 'es',
  setLocale: () => {},
});
export function LocaleProvider({
  children,
  initialLocale = 'es',
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    document.cookie = `cuantai_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
export function useText() {
  const { locale } = useLocale();
  return useCallback(
    <Value,>(value: Value, replacements?: unknown[]): Value => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      const translated =
        locale === 'es'
          ? value
          : (translations[locale][value] ??
            (translations[locale][trimmed]
              ? value.replace(trimmed, translations[locale][trimmed])
              : value));
      return (
        replacements
          ? translated.replace(/\{(\d+)\}/g, (match, index) =>
              index < replacements.length ? String(replacements[index] ?? '') : match,
            )
          : translated
      ) as Value;
    },
    [locale],
  );
}
export function T({ text, children }: { text?: string; children?: ReactNode }) {
  const t = useText();
  return (
    <>{text !== undefined ? t(text) : typeof children === 'string' ? t(children) : children}</>
  );
}
export function LanguageSwitcher({ persist = false }: { persist?: boolean }) {
  const { locale, setLocale } = useLocale();
  const t = useText();
  const cache = useQueryClient();
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  async function change(next: Locale) {
    setLocale(next);
    if (persist) {
      try {
        const response = await fetch('/api/data/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: next }),
        });
        if (!response.ok) throw new Error('language');
        await cache.invalidateQueries({ queryKey: ['settings'] });
      } catch {
        toast.error(t('No se pudo guardar el idioma en tu cuenta. Se conserva en este navegador.'));
      }
    }
  }
  return (
    <label className="language-switcher">
      <Languages size={16} aria-hidden="true" />
      <span className="sr-only">{t('Idioma')}</span>
      <select
        aria-label={t('Idioma')}
        value={locale}
        disabled={!hydrated}
        onChange={(event) => change(event.target.value as Locale)}
      >
        <option value="es">Español</option>
        <option value="en">English</option>
        <option value="pt">Português</option>
      </select>
    </label>
  );
}
const subscribeHydration = () => () => {};
