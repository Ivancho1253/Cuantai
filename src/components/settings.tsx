'use client';
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
  const { user, demo } = useApp();
  const data = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ preferences: Partial<Preferences> }>('settings'),
    enabled: Boolean(user) && !demo,
  });
  if (!user || demo)
    return (
      <>
        <SectionTitle
          title="Un espacio a tu medida."
          description="Tus preferencias se guardan de forma privada."
        />
        <EmptyState
          title="Hacé tuyo Cuantai."
          action={
            <Link href="/register" className="button button-primary">
              Crear cuenta
            </Link>
          }
        >
          Moneda, país, zona horaria, experiencia e intereses, sincronizados en tu cuenta.
        </EmptyState>
      </>
    );
  if (data.isError) return <ErrorState message={data.error.message} />;
  if (data.isLoading) return <p className="muted">Cargando preferencias...</p>;
  return (
    <SettingsForm
      key={JSON.stringify(data.data?.preferences)}
      initial={{ ...defaults, ...data.data?.preferences }}
      onboarding={onboarding}
    />
  );
}
function SettingsForm({ initial, onboarding }: { initial: Preferences; onboarding: boolean }) {
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
        eyebrow={onboarding ? 'BIENVENIDO A CUANTAI' : 'PERSONAL WORKSPACE'}
        title={onboarding ? 'Tu perspectiva es el punto de partida.' : 'Un espacio a tu medida.'}
        description={
          onboarding
            ? 'Contanos un poco sobre vos. Podés empezar sin cargar una cartera.'
            : 'Configurá cómo querés explorar tus inversiones.'
        }
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
              <UserRound size={18} /> Perfil
            </h2>
            <div className="profile-summary">
              <span className="profile-large-avatar">{user?.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{user?.name}</strong>
                <p>{user?.email}</p>
                <small>Cuenta personal · información privada</small>
              </div>
            </div>
          </div>
          <div className="settings-section">
            <h2>
              <Globe2 size={18} /> Tu perspectiva
            </h2>
            <div className="form-grid">
              <label>
                País
                <select value={form.country} onChange={(e) => field('country', e.target.value)}>
                  <option value="AR">Argentina</option>
                  <option value="US">Estados Unidos</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label>
                Moneda principal
                <select value={form.currency} onChange={(e) => field('currency', e.target.value)}>
                  {['USD', 'ARS', 'EUR', 'USDT'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Experiencia
                <select
                  value={form.experience}
                  onChange={(e) => field('experience', e.target.value)}
                >
                  <option value="beginner">Principiante</option>
                  <option value="intermediate">Intermedia</option>
                  <option value="advanced">Avanzada</option>
                </select>
              </label>
              <label>
                Tema visual
                <select value={form.theme} onChange={(e) => field('theme', e.target.value)}>
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                  <option value="system">Sistema</option>
                </select>
              </label>
              <label>
                Idioma preferido
                <select value={form.language} onChange={(e) => field('language', e.target.value)}>
                  <option value="es">Español</option>
                  <option value="en">English (traducción pendiente)</option>
                </select>
              </label>
              <label>
                Zona horaria
                <input
                  value={form.timezone}
                  onChange={(e) => field('timezone', e.target.value)}
                  required
                />
              </label>
            </div>
            <p className="form-hint">
              La moneda principal es una preferencia. Cada cartera conserva su propia moneda base y
              cada instrumento su moneda de negociación. Los timestamps de mercado se muestran en
              UTC.
            </p>
            <label className="interest-label">Mercados que te interesan</label>
            <div className="interest-options">
              {[
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
                  {form.interests.includes(value) && <Check size={13} />} {label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label>
                Horizonte (opcional)
                <input
                  value={form.horizon ?? ''}
                  placeholder="Ej.: largo plazo"
                  onChange={(e) => field('horizon', e.target.value)}
                />
              </label>
              <label>
                Perfil de riesgo (opcional)
                <select
                  value={form.risk ?? ''}
                  onChange={(e) => field('risk', e.target.value || undefined)}
                >
                  <option value="">Sin definir</option>
                  <option value="conservative">Conservador</option>
                  <option value="moderate">Moderado</option>
                  <option value="aggressive">Agresivo</option>
                </select>
              </label>
            </div>
          </div>
          <div className="settings-save">
            <span>Siempre podés cambiar tus preferencias.</span>
            <Button type="submit" disabled={busy}>
              {busy
                ? 'Guardando...'
                : onboarding
                  ? 'Entrar a mi workspace'
                  : 'Guardar preferencias'}{' '}
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
        <aside>
          <section className="panel settings-connections">
            <div className="panel-header">
              <strong>
                <PlugZap size={16} /> Conexiones de datos
              </strong>
            </div>
            <div className="provider-list">
              {Object.entries(status.data ?? {})
                .filter(([, v]) => v && typeof v === 'object' && 'configured' in v)
                .map(([k, v]) => {
                  const item = v as { configured: boolean; label: string };
                  return (
                    <div key={k}>
                      <span>{item.label}</span>
                      <small className={item.configured ? 'positive' : 'muted'}>
                        {item.configured ? 'Configurado' : 'Pendiente'}
                      </small>
                    </div>
                  );
                })}
            </div>
            <p>
              Las credenciales se configuran exclusivamente en el servidor. No se almacenan en tu
              navegador.
            </p>
          </section>
          <div className="privacy-note">
            <Shield size={20} />
            <h3>Tu espacio es privado.</h3>
            <p>
              Watchlists, carteras e informes están asociados a tu cuenta y protegidos por
              autorización del servidor.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
