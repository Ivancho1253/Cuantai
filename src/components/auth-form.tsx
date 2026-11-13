'use client';
import { useText as useUiText } from './locale-provider';
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
  const uiText = useUiText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const status = useQuery({
    queryKey: ['auth-status'],
    queryFn: () =>
      api<{
        auth: {
          google: boolean;
          passwordReset: boolean;
        };
      }>('status'),
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
            <Sparkles size={13} />
            {uiText(' FINANCIAL INTELLIGENCE')}
          </span>
          <h1>
            {uiText('Conect\u00E1 los puntos.')}
            <br />
            <em>
              {uiText('Encontr\u00E1 tu')}
              <br />
              {uiText('perspectiva.')}
            </em>
          </h1>
          <p>
            {uiText('El mercado es complejo.')}
            <br />
            {uiText('Tu espacio para entenderlo, no tiene por qu\u00E9 serlo.')}
          </p>
          <div className="auth-lines">
            {uiText(
              Array.from({ length: 25 }, (_, i) => (
                <i
                  key={i}
                  style={{ height: 30 + Math.sin(i / 3) * 35 + i * 5, opacity: 0.2 + i * 0.025 }}
                />
              )),
            )}
          </div>
          <span className="auth-art-caption">
            {uiText('MERCADOS \u00B7 INTELIGENCIA \u00B7 PATRIMONIO')}
          </span>
        </div>
        <footer>
          © {uiText(new Date().getFullYear())}
          {uiText(' Cuantai. Todos tus mercados. Una perspectiva.')}
        </footer>
      </div>
      <div className="auth-right">
        <Link href="/" className="auth-back">
          <ArrowLeft size={14} />
          {uiText(' Volver al inicio')}
        </Link>
        <div className="auth-form-wrap">
          <div className="eyebrow">{uiText('TU ESPACIO PRIVADO')}</div>
          <h2>{uiText(title)}</h2>
          <p>
            {uiText(
              register
                ? 'Creá tu cuenta y empezá a explorar con más claridad.'
                : mode === 'login'
                  ? 'Ingresá para retomar tus ideas e inversiones.'
                  : 'Recuperá el acceso de forma segura.',
            )}
          </p>
          {uiText(
            (mode === 'login' || register) && (
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
                  <span className="google-letter">{uiText('G')}</span>
                  {uiText(' Continuar con Google')}
                  {uiText(' ')}
                  {uiText(!status.data?.auth.google && <small>{uiText('Sin configurar')}</small>)}
                </Button>
                <div className="auth-divider">
                  <span>{uiText('o continu\u00E1 con email')}</span>
                </div>
              </>
            ),
          )}
          <form onSubmit={submit} className="form-stack">
            {uiText(
              register && (
                <label>
                  {uiText('Nombre')}
                  <input
                    name="name"
                    placeholder={uiText('Tu nombre')}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
              ),
            )}
            {uiText(
              mode !== 'reset' && (
                <label>
                  {uiText('Email')}
                  <input
                    name="email"
                    type="email"
                    placeholder={uiText('vos@ejemplo.com')}
                    autoComplete="email"
                    required
                  />
                </label>
              ),
            )}
            {uiText(
              mode !== 'forgot' && (
                <label>
                  {uiText('Contrase\u00F1a')}
                  <input
                    name="password"
                    type="password"
                    placeholder={uiText(register ? 'Al menos 10 caracteres' : 'Tu contraseña')}
                    autoComplete={
                      register || mode === 'reset' ? 'new-password' : 'current-password'
                    }
                    required
                    minLength={register || mode === 'reset' ? 10 : 1}
                    maxLength={128}
                  />
                </label>
              ),
            )}
            {uiText(
              mode === 'login' && (
                <Link className="forgot-link" href="/forgot-password">
                  {uiText('\u00BFOlvidaste tu contrase\u00F1a?')}
                </Link>
              ),
            )}
            {uiText(
              error && (
                <p className="form-error" role="alert">
                  {uiText(error)}
                </p>
              ),
            )}
            {uiText(
              success && (
                <p className="form-success" role="status">
                  {uiText(success)} <Link href="/login">{uiText('Iniciar sesi\u00F3n')}</Link>
                </p>
              ),
            )}
            {uiText(
              mode === 'forgot' && !status.data?.auth.passwordReset && (
                <p className="form-hint">
                  {uiText(
                    'El env\u00EDo de emails requiere configurar el proveedor en el servidor. No se enviar\u00E1 ning\u00FAn mensaje hasta habilitarlo.',
                  )}
                </p>
              ),
            )}
            <Button
              disabled={busy || (mode === 'forgot' && !status.data?.auth.passwordReset)}
              type="submit"
            >
              {uiText(
                busy
                  ? 'Un momento...'
                  : register
                    ? 'Crear mi cuenta'
                    : mode === 'forgot'
                      ? 'Enviar enlace'
                      : mode === 'reset'
                        ? 'Actualizar contraseña'
                        : 'Entrar a mi workspace',
              )}
              {uiText(' ')}
              <ArrowRight size={16} />
            </Button>
          </form>
          {uiText(
            (mode === 'login' || register) && (
              <>
                <p className="auth-switch">
                  {uiText(register ? '¿Ya tenés una cuenta?' : '¿Todavía no tenés una cuenta?')}
                  {uiText(' ')}
                  <Link href={register ? '/login' : '/register'}>
                    {uiText(register ? 'Iniciar sesión' : 'Crear cuenta')}
                  </Link>
                </p>
                <Link href="/demo" className="explore-auth">
                  {uiText('Explorar la plataforma primero ')}
                  <ArrowUpRight size={14} />
                </Link>
              </>
            ),
          )}
          <p className="auth-security">
            <LockKeyhole size={13} />
            {uiText(' Sesiones seguras. Tu workspace es privado.')}
          </p>
        </div>
        <div className="auth-legal">
          <Link href="/data-policy">{uiText('Datos, privacidad y metodolog\u00EDa')}</Link>
          <span>{uiText('Cuantai v0.1')}</span>
        </div>
      </div>
    </div>
  );
}
