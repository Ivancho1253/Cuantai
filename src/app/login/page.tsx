import { AuthForm } from '@/components/auth-form';
export const metadata = { title: 'Iniciar sesión', robots: { index: false } };
export default function Login() {
  return <AuthForm mode="login" />;
}
