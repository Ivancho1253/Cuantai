'use client';
import Link from 'next/link';
import { Button } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-error">
      <h1>No pudimos cargar este espacio.</h1>
      <p>La operación se interrumpió. Tus datos guardados permanecen en la base de datos.</p>
      <Button onClick={reset}>Reintentar</Button>
      <Link href="/">Volver al inicio</Link>
    </div>
  );
}
