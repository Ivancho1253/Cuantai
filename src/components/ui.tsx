'use client';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ArrowUpRight, X, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Provenance } from '@/lib/market/types';
export { AssetIcon } from './asset-icon';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Cuantai, inicio">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span className="brand-wordmark">
          cuantai<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
export function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <button className={cn('button', `button-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={cn('modal-content', className)}>
          <div className="modal-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ?? 'Tu espacio de trabajo en Cuantai.'}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Cerrar">
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6}>
          {text}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
export function DataBadge({ status = 'demo' }: { status?: Provenance['status'] }) {
  const labels = {
    demo: 'DEMO',
    realtime: 'EN VIVO',
    delayed: 'DEMORADO',
    eod: 'CIERRE',
    manual: 'MANUAL',
    unavailable: 'SIN DATOS',
  };
  return (
    <span className={cn('data-badge', status === 'realtime' && 'live')}>
      <span />
      {labels[status]}
    </span>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Activity size={25} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="error-state">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <button onClick={retry}>
          Reintentar <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div aria-label="Cargando" className={cn('skeleton', className)} />;
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
