import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="page-error">
      <span className="eyebrow">404 · FUERA DEL MAPA</span>
      <h1>Esta perspectiva todavía no existe.</h1>
      <Link href="/demo" className="button button-primary">
        Volver al workspace
      </Link>
    </div>
  );
}
