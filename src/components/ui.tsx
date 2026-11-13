'use client';
import { useText as useUiText } from './locale-provider';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ArrowUpRight, X, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Provenance } from '@/lib/market/types';
export { AssetIcon } from './asset-icon';
export function Brand({ compact = false }: { compact?: boolean }) {
  const uiText = useUiText();
  return (
    <Link href="/" className="brand" aria-label={uiText('Cuantai, inicio')}>
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      {uiText(
        !compact && (
          <span className="brand-wordmark">
            {uiText('cuantai')}
            <span className="brand-dot">.</span>
          </span>
        ),
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
  const uiText = useUiText();
  return (
    <button className={cn('button', `button-${variant}`, className)} {...props}>
      {uiText(children)}
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
  const uiText = useUiText();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={cn('modal-content', className)}>
          <div className="modal-header">
            <div>
              <Dialog.Title>{uiText(title)}</Dialog.Title>
              <Dialog.Description>
                {uiText(description ?? 'Tu espacio de trabajo en Cuantai.')}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label={uiText('Cerrar')}>
              <X size={19} />
            </Dialog.Close>
          </div>
          {uiText(children)}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const uiText = useUiText();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{uiText(children)}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6}>
          {uiText(text)}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
export function DataBadge({ status = 'demo' }: { status?: Provenance['status'] }) {
  const uiText = useUiText();
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
      {uiText(labels[status])}
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
  const uiText = useUiText();
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Activity size={25} />
      </div>
      <h3>{uiText(title)}</h3>
      <p>{uiText(children)}</p>
      {uiText(action)}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const uiText = useUiText();
  return (
    <div role="alert" className="error-state">
      <AlertCircle size={18} />
      <span>{uiText(message)}</span>
      {uiText(
        retry && (
          <button onClick={retry}>
            {uiText('Reintentar ')}
            <ArrowUpRight size={14} />
          </button>
        ),
      )}
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  const uiText = useUiText();
  return <div aria-label={uiText('Cargando')} className={cn('skeleton', className)} />;
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
  const uiText = useUiText();
  return (
    <div className="section-title">
      <div>
        {uiText(eyebrow && <div className="eyebrow">{uiText(eyebrow)}</div>)}
        <h1>{uiText(title)}</h1>
        {uiText(description && <p>{uiText(description)}</p>)}
      </div>
      {uiText(action)}
    </div>
  );
}
