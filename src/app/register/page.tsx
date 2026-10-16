import { AuthForm } from '@/components/auth-form';
export const metadata = { title: 'Crear cuenta', robots: { index: false } };
export default function Register() {
  return <AuthForm mode="register" />;
}
