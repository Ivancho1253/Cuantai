'use client';
import { useText as useUiText } from './locale-provider';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ArrowRight, Globe2, UserRound, PlugZap, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from './app-shell';
import { Button, SectionTitle, EmptyState, ErrorState } from './ui';
import { api } from '@/lib/utils';
import { useLocale, type Locale } from './locale-provider';
type Preferences = {
  country: string;
  currency: string;
  experience: string;
  language: string;
  theme: string;
  timezone: string;
  interests: string[];
  onboarded: boolean;
  horizon?: string;
  risk?: string;
};
const defaults: Preferences = {
  country: 'AR',
  currency: 'USD',
  experience: 'intermediate',
  language: 'es',
  theme: 'dark',
  timezone: 'America/Argentina/Cordoba',
  interests: ['stocks', 'crypto', 'argentina'],
  onboarded: false,
};
export function Settings({ onboarding = false }: { onboarding?: boolean }) {
  const uiText = useUiText();
  const { user, demo } = useApp();
  const data = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      api<{
        preferences: Partial<Preferences>;
      }>('settings'),
    enabled: Boolean(user) && !demo,
  });
  if (!user || demo)
    return (
      <>
        <SectionTitle
          title={uiText('Un espacio a tu medida.')}
          description={uiText('Tus preferencias se guardan de forma privada.')}
        />
        <EmptyState
          title={uiText('Hac\u00E9 tuyo Cuantai.')}
          action={
            <Link href="/register" className="button button-primary">
              {uiText('Crear cuenta')}
            </Link>
          }
        >
          {uiText(
            'Moneda, pa\u00EDs, zona horaria, experiencia e intereses, sincronizados en tu cuenta.',
          )}
        </EmptyState>
      </>
    );
  if (data.isError) return <ErrorState message={data.error.message} />;
  if (data.isLoading) return <p className="muted">{uiText('Cargando preferencias...')}</p>;
  return (
    <SettingsForm
      key={JSON.stringify(data.data?.preferences)}
      initial={{ ...defaults, ...data.data?.preferences }}
      onboarding={onboarding}
    />
  );
}
function SettingsForm({ initial, onboarding }: { initial: Preferences; onboarding: boolean }) {
  const uiText = useUiText();
  const { setLocale } = useLocale();
  const { user } = useApp();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { setTheme } = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => api<Record<string, unknown>>('status'),
  });
  const field = (key: keyof Preferences, value: unknown) => setForm({ ...form, [key]: value });
  async function save() {
    setBusy(true);
    try {
      await api('settings', { method: 'PUT', body: JSON.stringify({ ...form, onboarded: true }) });
      setTheme(form.theme);
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Preferencias guardadas');
      if (onboarding) router.push('/dashboard');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow={uiText(onboarding ? 'BIENVENIDO A CUANTAI' : 'PERSONAL WORKSPACE')}
        title={uiText(
          onboarding ? 'Tu perspectiva es el punto de partida.' : 'Un espacio a tu medida.',
        )}
        description={uiText(
          onboarding
            ? 'Contanos un poco sobre vos. Podés empezar sin cargar una cartera.'
            : 'Configurá cómo querés explorar tus inversiones.',
        )}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="settings-layout"
      >
        <div className="panel settings-main">
          <div className="settings-section">
            <h2>
              <UserRound size={18} />
              {uiText(' Perfil')}
            </h2>
            <div className="profile-summary">
              <span className="profile-large-avatar">
                {uiText(user?.name.slice(0, 2).toUpperCase())}
              </span>
              <div>
                <strong>{uiText(user?.name)}</strong>
                <p>{uiText(user?.email)}</p>
                <small>{uiText('Cuenta personal \u00B7 informaci\u00F3n privada')}</small>
              </div>
            </div>
          </div>
          <div className="settings-section">
            <h2>
              <Globe2 size={18} />
              {uiText(' Tu perspectiva')}
            </h2>
            <div className="form-grid">
              <label>
                {uiText('Pa\u00EDs')}
                <select value={form.country} onChange={(e) => field('country', e.target.value)}>
                  <option value="AR">{uiText('Argentina')}</option>
                  <option value="US">{uiText('Estados Unidos')}</option>
                  <option value="other">{uiText('Otro')}</option>
                </select>
              </label>
              <label>
                {uiText('Moneda principal')}
                <select value={form.currency} onChange={(e) => field('currency', e.target.value)}>
                  {uiText(
                    ['USD', 'ARS', 'EUR', 'USDT'].map((v) => <option key={v}>{uiText(v)}</option>),
                  )}
                </select>
              </label>
              <label>
                {uiText('Experiencia')}
                <select
                  value={form.experience}
                  onChange={(e) => field('experience', e.target.value)}
                >
                  <option value="beginner">{uiText('Principiante')}</option>
                  <option value="intermediate">{uiText('Intermedia')}</option>
                  <option value="advanced">{uiText('Avanzada')}</option>
                </select>
              </label>
              <label>
                {uiText('Tema visual')}
                <select value={form.theme} onChange={(e) => field('theme', e.target.value)}>
                  <option value="dark">{uiText('Oscuro')}</option>
                  <option value="light">{uiText('Claro')}</option>
                  <option value="system">{uiText('Sistema')}</option>
                </select>
              </label>
              <label>
                {uiText('Idioma preferido')}
                <select
                  value={form.language}
                  onChange={(e) => {
                    field('language', e.target.value);
                    setLocale(e.target.value as Locale);
                  }}
                >
                  <option value="es">{uiText('Espa\u00F1ol')}</option>
                  <option value="en">{uiText('English')}</option>
                  <option value="pt">{uiText('Portugu\u00EAs')}</option>
                </select>
              </label>
              <label>
                {uiText('Zona horaria')}
                <input
                  value={form.timezone}
                  onChange={(e) => field('timezone', e.target.value)}
                  required
                />
              </label>
            </div>
            <p className="form-hint">
              {uiText(
                'La moneda principal es una preferencia. Cada cartera conserva su propia moneda base y cada instrumento su moneda de negociaci\u00F3n. Los timestamps de mercado se muestran en UTC.',
              )}
            </p>
            <label className="interest-label">{uiText('Mercados que te interesan')}</label>
            <div className="interest-options">
              {uiText(
                [
                  ['stocks', 'Acciones'],
                  ['etfs', 'ETFs'],
                  ['crypto', 'Criptomonedas'],
                  ['argentina', 'Argentina & CEDEARs'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={form.interests.includes(value) ? 'active' : ''}
                    type="button"
                    onClick={() =>
                      field(
                        'interests',
                        form.interests.includes(value)
                          ? form.interests.filter((i) => i !== value)
                          : [...form.interests, value],
                      )
                    }
                  >
                    {uiText(form.interests.includes(value) && <Check size={13} />)} {uiText(label)}
                  </button>
                )),
              )}
            </div>
            <div className="form-grid">
              <label>
                {uiText('Horizonte (opcional)')}
                <input
                  value={form.horizon ?? ''}
                  placeholder={uiText('Ej.: largo plazo')}
                  onChange={(e) => field('horizon', e.target.value)}
                />
              </label>
              <label>
                {uiText('Perfil de riesgo (opcional)')}
                <select
                  value={form.risk ?? ''}
                  onChange={(e) => field('risk', e.target.value || undefined)}
                >
                  <option value="">{uiText('Sin definir')}</option>
                  <option value="conservative">{uiText('Conservador')}</option>
                  <option value="moderate">{uiText('Moderado')}</option>
                  <option value="aggressive">{uiText('Agresivo')}</option>
                </select>
              </label>
            </div>
          </div>
          <div className="settings-save">
            <span>{uiText('Siempre pod\u00E9s cambiar tus preferencias.')}</span>
            <Button type="submit" disabled={busy}>
              {uiText(
                busy
                  ? 'Guardando...'
                  : onboarding
                    ? 'Entrar a mi workspace'
                    : 'Guardar preferencias',
              )}
              {uiText(' ')}
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
        <aside>
          <section className="panel settings-connections">
            <div className="panel-header">
              <strong>
                <PlugZap size={16} />
                {uiText(' Conexiones de datos')}
              </strong>
            </div>
            <div className="provider-list">
              {uiText(
                Object.entries(status.data ?? {})
                  .filter(([, v]) => v && typeof v === 'object' && 'configured' in v)
                  .map(([k, v]) => {
                    const item = v as {
                      configured: boolean;
                      label: string;
                    };
                    return (
                      <div key={k}>
                        <span>{uiText(item.label)}</span>
                        <small className={item.configured ? 'positive' : 'muted'}>
                          {uiText(item.configured ? 'Configurado' : 'Pendiente')}
                        </small>
                      </div>
                    );
                  }),
              )}
            </div>
            <p>
              {uiText(
                'Las credenciales se configuran exclusivamente en el servidor. No se almacenan en tu navegador.',
              )}
            </p>
          </section>
          <div className="privacy-note">
            <Shield size={20} />
            <h3>{uiText('Tu espacio es privado.')}</h3>
            <p>
              {uiText(
                'Watchlists, carteras e informes est\u00E1n asociados a tu cuenta y protegidos por autorizaci\u00F3n del servidor.',
              )}
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
