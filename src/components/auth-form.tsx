'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, ArrowLeft, Sparkles, LockKeyhole } from 'lucide-react';
import { Brand, Button } from './ui';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/utils';
export function AuthForm({
  mode,
  token,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset';
  token?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const status = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api<{ auth: { google: boolean; passwordReset: boolean } }>('status'),
  });
  const register = mode === 'register';
  const title = register
    ? 'Tu próxima perspectiva.'
    : mode === 'forgot'
      ? 'Volvé a tu espacio.'
      : mode === 'reset'
        ? 'Un nuevo comienzo.'
        : 'Bienvenido a tu ventaja.';
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (mode === 'forgot') {
        if (!status.data?.auth.passwordReset)
          throw new Error(
            'El servicio de email aún no está configurado. Contactá al administrador.',
          );
        const r = await authClient.requestPasswordReset({
          email: String(f.get('email')),
          redirectTo: '/reset-password',
        });
        if (r.error) throw new Error(r.error.message);
        setSuccess(
          'Si existe una cuenta con ese email, recibirás un enlace para recuperar el acceso.',
        );
      } else if (mode === 'reset') {
        const r = await authClient.resetPassword({
          newPassword: String(f.get('password')),
          token: token ?? '',
        });
        if (r.error) throw new Error(r.error.message);
        setSuccess('Contraseña actualizada. Ya podés iniciar sesión.');
      } else {
        const r = register
          ? await authClient.signUp.email({
              name: String(f.get('name')),
              email: String(f.get('email')),
              password: String(f.get('password')),
            })
          : await authClient.signIn.email({
              email: String(f.get('email')),
              password: String(f.get('password')),
            });
        if (r.error) throw new Error(r.error.message ?? 'No se pudo iniciar sesión');
        router.replace(register ? '/onboarding' : '/dashboard');
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-left">
        <Brand />
        <div className="auth-art">
          <span className="outlined-chip">
            <Sparkles size={13} /> FINANCIAL INTELLIGENCE
          </span>
          <h1>
            Conectá los puntos.
            <br />
            <em>
              Encontrá tu
              <br />
              perspectiva.
            </em>
          </h1>
          <p>
            El mercado es complejo.
            <br />
            Tu espacio para entenderlo, no tiene por qué serlo.
          </p>
          <div className="auth-lines">
            {Array.from({ length: 25 }, (_, i) => (
              <i
                key={i}
                style={{ height: 30 + Math.sin(i / 3) * 35 + i * 5, opacity: 0.2 + i * 0.025 }}
              />
            ))}
          </div>
          <span className="auth-art-caption">MERCADOS · INTELIGENCIA · PATRIMONIO</span>
        </div>
        <footer>© {new Date().getFullYear()} Cuantai. Todos tus mercados. Una perspectiva.</footer>
      </div>
      <div className="auth-right">
        <Link href="/" className="auth-back">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>
        <div className="auth-form-wrap">
          <div className="eyebrow">TU ESPACIO PRIVADO</div>
          <h2>{title}</h2>
          <p>
            {register
              ? 'Creá tu cuenta y empezá a explorar con más claridad.'
              : mode === 'login'
                ? 'Ingresá para retomar tus ideas e inversiones.'
                : 'Recuperá el acceso de forma segura.'}
          </p>
          {(mode === 'login' || register) && (
            <>
              <Button
                variant="secondary"
                className="google-button"
                disabled={!status.data?.auth.google || busy}
                onClick={async () => {
                  setError('');
                  const r = await authClient.signIn.social({
                    provider: 'google',
                    callbackURL: '/dashboard',
                  });
                  if (r.error) setError(r.error.message ?? 'Google no disponible');
                }}
              >
                <span className="google-letter">G</span> Continuar con Google{' '}
                {!status.data?.auth.google && <small>Sin configurar</small>}
              </Button>
              <div className="auth-divider">
                <span>o continuá con email</span>
              </div>
            </>
          )}
          <form onSubmit={submit} className="form-stack">
            {register && (
              <label>
                Nombre
                <input
                  name="name"
                  placeholder="Tu nombre"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            )}
            {mode !== 'reset' && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  placeholder="vos@ejemplo.com"
                  autoComplete="email"
                  required
                />
              </label>
            )}
            {mode !== 'forgot' && (
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  placeholder={register ? 'Al menos 10 caracteres' : 'Tu contraseña'}
                  autoComplete={register || mode === 'reset' ? 'new-password' : 'current-password'}
                  required
                  minLength={register || mode === 'reset' ? 10 : 1}
                  maxLength={128}
                />
              </label>
            )}
            {mode === 'login' && (
              <Link className="forgot-link" href="/forgot-password">
                ¿Olvidaste tu contraseña?
              </Link>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="form-success" role="status">
                {success} <Link href="/login">Iniciar sesión</Link>
              </p>
            )}
            {mode === 'forgot' && !status.data?.auth.passwordReset && (
              <p className="form-hint">
                El envío de emails requiere configurar el proveedor en el servidor. No se enviará
                ningún mensaje hasta habilitarlo.
              </p>
            )}
            <Button
              disabled={busy || (mode === 'forgot' && !status.data?.auth.passwordReset)}
              type="submit"
            >
              {busy
                ? 'Un momento...'
                : register
                  ? 'Crear mi cuenta'
                  : mode === 'forgot'
                    ? 'Enviar enlace'
                    : mode === 'reset'
                      ? 'Actualizar contraseña'
                      : 'Entrar a mi workspace'}{' '}
              <ArrowRight size={16} />
            </Button>
          </form>
          {(mode === 'login' || register) && (
            <>
              <p className="auth-switch">
                {register ? '¿Ya tenés una cuenta?' : '¿Todavía no tenés una cuenta?'}{' '}
                <Link href={register ? '/login' : '/register'}>
                  {register ? 'Iniciar sesión' : 'Crear cuenta'}
                </Link>
              </p>
              <Link href="/demo" className="explore-auth">
                Explorar la plataforma primero <ArrowUpRight size={14} />
              </Link>
            </>
          )}
          <p className="auth-security">
            <LockKeyhole size={13} /> Sesiones seguras. Tu workspace es privado.
          </p>
        </div>
        <div className="auth-legal">
          <Link href="/data-policy">Datos, privacidad y metodología</Link>
          <span>Cuantai v0.1</span>
        </div>
      </div>
    </div>
  );
}
