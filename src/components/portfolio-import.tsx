'use client';
import { useText as useUiText } from './locale-provider';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileSpreadsheet,
  ImagePlus,
  Wallet,
  Check,
  Upload,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useApp } from './app-shell';
import { api } from '@/lib/utils';
import { Button, Modal } from './ui';
import { ResearchAssetPicker } from './research-asset-picker';
import { canonicalRow } from '@/lib/portfolio-import/fields';
import { receiptRows } from '@/lib/portfolio-import/text-parser';
import type { DraftRow } from '@/lib/portfolio-import/parser';
import type { WalletRead } from '@/lib/portfolio-import/wallet';
import type { FileSheet } from '@/lib/portfolio-import/files';
import type { Currency } from '@/lib/market/types';
type Account = {
  id: string;
  name: string;
  baseCurrency: Currency;
};
type Preview = {
  id: string;
  rows: DraftRow[];
  valid: number;
};
const fields = [
  ['symbol', 'Activo'],
  ['quantity', 'Cantidad'],
  ['price', 'Precio unitario / costo promedio'],
  ['date', 'Fecha'],
  ['type', 'Operación'],
  ['currency', 'Moneda'],
  ['fees', 'Comisiones'],
  ['reference', 'Referencia'],
] as const;
async function request<T>(body: unknown): Promise<T> {
  const response = await fetch('/api/portfolio-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'No se pudo procesar la importación');
  return data;
}
export function PortfolioImport({
  open,
  onOpenChange,
  portfolios,
  selectedId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolios: Account[];
  selectedId?: string;
  onImported: (id: string) => void;
}) {
  const uiText = useUiText();
  const { user, demo } = useApp();
  const networks = useQuery({
    queryKey: ['wallet-networks'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio-import');
      if (!response.ok) throw new Error('networks');
      return response.json() as Promise<{ networks: Record<string, boolean> }>;
    },
    enabled: Boolean(user) && !demo,
  });
  const [source, setSource] = useState<'file' | 'image' | 'wallet'>('file');
  const [mode, setMode] = useState<'trades' | 'holdings'>('trades');
  const [target, setTarget] = useState(selectedId ?? 'new');
  const [name, setName] = useState('Cartera importada');
  const [base, setBase] = useState<Currency>('USD');
  const [format, setFormat] = useState<'es' | 'en'>('es');
  const [market, setMarket] = useState('auto');
  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sheets, setSheets] = useState<FileSheet[]>([]);
  const [sheet, setSheet] = useState(0);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState<number>();
  const [fileName, setFileName] = useState('Archivo');
  const [chain, setChain] = useState('ethereum');
  const [address, setAddress] = useState('');
  const [wallet, setWallet] = useState<WalletRead>();
  const [preview, setPreview] = useState<Preview>();
  const [prepared, setPrepared] = useState<Record<string, string>[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState<number>();
  const uploadVersion = useRef(0);
  const fileRead = useRef<AbortController | null>(null);
  function invalidate() {
    setDirty(true);
    setComplete(undefined);
  }
  function chooseSheet(index: number, next = sheets) {
    setSheet(index);
    const rows = next[index]?.rows ?? [];
    setColumns(
      canonicalRow(
        Object.fromEntries(Object.keys(rows[0] ?? {}).map((header) => [header, header])),
      ),
    );
    setPreview(undefined);
    setPrepared([]);
  }
  async function readFile(file?: File) {
    if (!file) return;
    const version = ++uploadVersion.current;
    fileRead.current?.abort();
    const controller = new AbortController();
    fileRead.current = controller;
    setBusy(true);
    setError('');
    setPreview(undefined);
    setComplete(undefined);
    setSheets([]);
    setText('');
    setPrepared([]);
    setDirty(false);
    try {
      const { readPortfolioFile } = await import('@/lib/portfolio-import/files');
      const result = await readPortfolioFile(
        file,
        mode,
        (message) => {
          if (version === uploadVersion.current) setProgress(message);
        },
        controller.signal,
      );
      if (version !== uploadVersion.current) return;
      setFileName(file.name);
      setSheets(result.sheets);
      chooseSheet(0, result.sheets);
      setText(result.text ?? '');
      setConfidence(result.confidence);
    } catch (e) {
      if (version === uploadVersion.current && !controller.signal.aborted)
        setError((e as Error).message);
    } finally {
      if (version === uploadVersion.current) {
        setBusy(false);
        setProgress('');
      }
    }
  }
  async function readAddress(cursor?: string) {
    setBusy(true);
    setError('');
    try {
      const result = await request<WalletRead>({ action: 'wallet', chain, address, cursor });
      setWallet((previous) =>
        cursor && previous
          ? { ...result, activity: [...previous.activity, ...result.activity] }
          : result,
      );
      setMode('holdings');
      setFormat('en');
      setSource('wallet');
      setPreview(undefined);
      setComplete(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function rowsForPreview() {
    if (dirty && prepared.length) return prepared;
    const raw = source === 'wallet' ? (wallet?.rows ?? []) : (sheets[sheet]?.rows ?? []);
    return raw.map((row) => {
      const mapped = { ...row };
      for (const [field, column] of Object.entries(columns))
        if (column && row[column] !== undefined) mapped[field] = row[column];
      if (mode === 'holdings' && !canonicalRow(mapped).date) mapped.date = snapshotDate;
      return mapped;
    });
  }
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      let portfolioId = target;
      if (target === 'new') {
        const created = await api<Account>('portfolios', {
          method: 'POST',
          body: JSON.stringify({ name, baseCurrency: base }),
        });
        portfolioId = created.id;
        setTarget(created.id);
      }
      const rows = rowsForPreview();
      if (!rows.length && !(source === 'wallet' && wallet?.completeSnapshot))
        throw new Error('Primero cargá un archivo o consultá una wallet');
      const data = await request<Preview>({
        action: 'preview',
        portfolioId,
        mode,
        numberFormat: format,
        market,
        source: source === 'wallet' ? wallet?.source : fileName,
        sourceKey: source === 'wallet' ? wallet?.sourceKey : undefined,
        completeSnapshot: source === 'wallet' && wallet?.completeSnapshot,
        rows,
      });
      setPreview(data);
      setPrepared(data.rows.map((row) => row.raw));
      setSelected(
        data.rows.filter((row) => !row.errors.length && !row.duplicate).map((row) => row.id),
      );
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(index: number, field: string, value: string) {
    setPrepared((previous) =>
      previous.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
    invalidate();
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const result = await request<{
        imported: number;
        portfolioId: string;
      }>({
        action: 'confirm',
        id: preview.id,
        selectedIds: selected,
      });
      setComplete(result.imported);
      onImported(result.portfolioId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const headers = Object.keys(sheets[sheet]?.rows[0] ?? {});
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          uploadVersion.current++;
          fileRead.current?.abort();
        }
        onOpenChange(next);
      }}
      title={uiText('Importar cartera')}
      description={uiText(
        'Carg\u00E1 tus datos de una vez. Revis\u00E1 lo detectado y confirm\u00E1 qu\u00E9 quer\u00E9s registrar.',
      )}
      className="portfolio-import-modal"
    >
      {uiText(
        !user || demo ? (
          <div className="import-login">
            <p>
              {uiText('Inici\u00E1 sesi\u00F3n para importar movimientos y guardar tu cartera.')}
            </p>
            <Link href="/login" className="button button-primary">
              {uiText('Iniciar sesi\u00F3n')}
            </Link>
          </div>
        ) : complete !== undefined ? (
          <div className="import-success">
            <Check size={36} />
            <h2>{uiText('Importaci\u00F3n completada')}</h2>
            <p>
              {uiText('Movimientos registrados: ')}
              {uiText(complete)}
            </p>
            <Button onClick={() => onOpenChange(false)}>{uiText('Ver mi cartera')}</Button>
          </div>
        ) : (
          <div className="import-body">
            <div
              className="import-source-tabs"
              role="tablist"
              aria-label={uiText('Origen de importaci\u00F3n')}
            >
              {uiText(
                [
                  ['file', 'Excel / CSV', FileSpreadsheet],
                  ['image', 'Foto o captura', ImagePlus],
                  ['wallet', 'Wallet', Wallet],
                ].map(([value, label, Icon]) => {
                  const I = Icon as typeof Wallet;
                  return (
                    <button
                      key={String(value)}
                      role="tab"
                      aria-selected={source === value}
                      disabled={busy}
                      onClick={() => {
                        setSource(value as typeof source);
                        setPreview(undefined);
                        setDirty(false);
                        setPrepared([]);
                        setSheets([]);
                        setText('');
                        setWallet(undefined);
                        setError('');
                      }}
                    >
                      <I size={20} />
                      {uiText(String(label))}
                    </button>
                  );
                }),
              )}
            </div>
            <div className="import-target">
              <label>
                {uiText('Cartera de destino')}
                <select
                  aria-label={uiText('Cartera de destino')}
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setPreview(undefined);
                  }}
                >
                  {uiText(
                    portfolios.map((account) => (
                      <option key={account.id} value={account.id}>
                        {uiText(account.name)}
                      </option>
                    )),
                  )}
                  {uiText(
                    target !== 'new' && !portfolios.some((account) => account.id === target) && (
                      <option value={target}>{uiText(name)}</option>
                    ),
                  )}
                  <option value="new">{uiText('Crear una nueva cartera')}</option>
                </select>
              </label>
              {uiText(
                target === 'new' && (
                  <>
                    <label>
                      {uiText('Nombre de la cartera')}
                      <input
                        aria-label={uiText('Nombre de cartera importada')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      {uiText('Moneda base')}
                      <select value={base} onChange={(e) => setBase(e.target.value as Currency)}>
                        {uiText(
                          ['USD', 'ARS', 'USDT', 'EUR'].map((value) => (
                            <option key={value}>{uiText(value)}</option>
                          )),
                        )}
                      </select>
                    </label>
                  </>
                ),
              )}
            </div>
            {uiText(
              source === 'wallet' ? (
                <section className="import-wallet">
                  <p>
                    {uiText(
                      'Solo direcci\u00F3n p\u00FAblica. No se conecta tu billetera, no se solicitan firmas ni claves privadas.',
                    )}
                  </p>
                  <div className="import-wallet-controls">
                    <label>
                      {uiText('Red')}
                      <select
                        aria-label={uiText('Red de la wallet')}
                        value={chain}
                        onChange={(e) => {
                          setChain(e.target.value);
                          setWallet(undefined);
                          setPreview(undefined);
                        }}
                      >
                        <option value="ethereum">{uiText('EVM \u00B7 Ethereum')}</option>
                        <option value="solana">{uiText('Solana')}</option>
                        <option value="base" disabled={!networks.data?.networks.base}>
                          {uiText('EVM · Base')}
                        </option>
                        <option value="arbitrum" disabled={!networks.data?.networks.arbitrum}>
                          {uiText('EVM · Arbitrum')}
                        </option>
                        <option value="optimism" disabled={!networks.data?.networks.optimism}>
                          {uiText('EVM · Optimism')}
                        </option>
                        <option value="polygon" disabled={!networks.data?.networks.polygon}>
                          {uiText('EVM · Polygon')}
                        </option>
                      </select>
                    </label>
                    <label>
                      {uiText('Direcci\u00F3n p\u00FAblica')}
                      <input
                        aria-label={uiText('Direcci\u00F3n p\u00FAblica')}
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          setWallet(undefined);
                          setPreview(undefined);
                        }}
                        placeholder={uiText('0x\u2026 o direcci\u00F3n de Solana')}
                        maxLength={90}
                      />
                    </label>
                    <Button disabled={busy || !address.trim()} onClick={() => readAddress()}>
                      {uiText('Consultar wallet')}
                    </Button>
                  </div>
                  {uiText(
                    wallet && (
                      <>
                        <p>
                          {uiText('Activos con saldo: ')}
                          {uiText(wallet.rows.length)}
                        </p>
                        {uiText(
                          wallet.warnings.map((w) => (
                            <p className="form-hint" key={w}>
                              {uiText(w)}
                            </p>
                          )),
                        )}
                        <details className="import-wallet-history">
                          <summary>
                            {uiText('Actividad reciente \u00B7 ')}
                            {uiText(wallet.activity.length)}
                          </summary>
                          {uiText(
                            wallet.activity.map((activity, index) => (
                              <div key={`${activity.id}-${index}`}>
                                <strong>{uiText(activity.label)}</strong>
                                <p>{uiText(activity.details)}</p>
                                <small>{uiText(activity.date)}</small>
                                <a href={activity.url} target="_blank" rel="noreferrer">
                                  {uiText('Detalle de la transacci\u00F3n ')}
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                            )),
                          )}
                          {uiText(
                            chain === 'solana' && wallet.nextCursor && (
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => readAddress(wallet.nextCursor)}
                              >
                                {uiText('Cargar m\u00E1s actividad')}
                              </Button>
                            ),
                          )}
                          <p className="form-hint">
                            {uiText(
                              'Los saldos se importan por separado del historial. No se convierten transferencias en compras o ventas sin evidencia.',
                            )}
                          </p>
                        </details>
                      </>
                    ),
                  )}
                </section>
              ) : (
                <>
                  <div className="import-options">
                    <label>
                      {uiText('Contenido')}
                      <select
                        aria-label={uiText('Tipo de contenido')}
                        value={mode}
                        onChange={(e) => {
                          setMode(e.target.value as typeof mode);
                          setPreview(undefined);
                          setPrepared([]);
                          setDirty(false);
                        }}
                      >
                        <option value="trades">{uiText('Compras, ventas y movimientos')}</option>
                        <option value="holdings">{uiText('Tenencias / saldos actuales')}</option>
                      </select>
                    </label>
                    <label>
                      {uiText('Formato de n\u00FAmeros y fecha')}
                      <select
                        aria-label={uiText('Formato del archivo')}
                        value={format}
                        onChange={(e) => {
                          setFormat(e.target.value as typeof format);
                          setPreview(undefined);
                          setPrepared([]);
                          setDirty(false);
                        }}
                      >
                        <option value="es">
                          {uiText('1.234,56 \u00B7 d\u00EDa/mes/a\u00F1o')}
                        </option>
                        <option value="en">
                          {uiText('1,234.56 \u00B7 mes/d\u00EDa/a\u00F1o')}
                        </option>
                      </select>
                    </label>
                    <label>
                      {uiText('Mercado preferido')}
                      <select
                        value={market}
                        onChange={(e) => {
                          setMarket(e.target.value);
                          setPreview(undefined);
                          setPrepared([]);
                          setDirty(false);
                        }}
                      >
                        <option value="auto">{uiText('Detectar por moneda y especie')}</option>
                        <option value="US">{uiText('Acciones USA / ETFs')}</option>
                        <option value="AR">{uiText('Acciones ARG')}</option>
                        <option value="cedear">{uiText('CEDEARs')}</option>
                        <option value="crypto">{uiText('Crypto')}</option>
                      </select>
                    </label>
                    {uiText(
                      mode === 'holdings' && (
                        <label>
                          {uiText('Fecha del resumen')}
                          <input
                            aria-label={uiText('Fecha del resumen')}
                            type="date"
                            value={snapshotDate}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => {
                              setSnapshotDate(e.target.value);
                              setPreview(undefined);
                              setPrepared([]);
                              setDirty(false);
                            }}
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <label className="import-dropzone">
                    <Upload size={26} />
                    <strong>
                      {uiText(
                        source === 'image'
                          ? 'Seleccionar foto o captura'
                          : 'Seleccionar Excel o CSV',
                      )}
                    </strong>
                    <span>
                      {uiText(
                        source === 'image'
                          ? 'PNG, JPG o WebP. La lectura OCR se hace en este navegador.'
                          : 'XLSX, CSV o TSV. Hasta 500 filas por lote.',
                      )}
                    </span>
                    <input
                      aria-label={uiText('Archivo de cartera')}
                      type="file"
                      disabled={busy}
                      accept={source === 'image' ? '.png,.jpg,.jpeg,.webp' : '.xlsx,.csv,.tsv'}
                      onChange={(e) => {
                        readFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {uiText(
                    sheets.length > 1 && (
                      <label>
                        {uiText('Hoja del Excel')}
                        <select
                          aria-label={uiText('Hoja del Excel')}
                          value={sheet}
                          onChange={(e) => chooseSheet(Number(e.target.value))}
                        >
                          {uiText(
                            sheets.map((item, index) => (
                              <option key={index} value={index}>
                                {uiText(item.name)}
                              </option>
                            )),
                          )}
                        </select>
                      </label>
                    ),
                  )}
                  {uiText(
                    text && (
                      <details className="import-ocr" open>
                        <summary>
                          {uiText('Texto le\u00EDdo de la imagen')}
                          {uiText(confidence !== undefined ? ` · ${Math.round(confidence)}%` : '')}
                        </summary>
                        <textarea
                          aria-label={uiText('Texto le\u00EDdo de la imagen')}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          rows={7}
                        />
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const next = [{ name: fileName, rows: receiptRows(text, mode) }];
                            setSheets(next);
                            chooseSheet(0, next);
                          }}
                        >
                          {uiText('Interpretar texto corregido')}
                        </Button>
                        <p className="form-hint">
                          {uiText(
                            'La lectura puede confundir separadores, letras o cifras. Revis\u00E1 las filas antes de confirmar.',
                          )}
                        </p>
                      </details>
                    ),
                  )}
                  {uiText(
                    headers.length > 0 && !text && (
                      <details className="import-column-mapping">
                        <summary>{uiText('Relacionar columnas del archivo')}</summary>
                        <div className="import-mapping-grid">
                          {uiText(
                            fields.map(([key, label]) => (
                              <label key={key}>
                                {uiText(label)}
                                <select
                                  aria-label={uiText('Columna: {0}', [label])}
                                  value={columns[key] ?? ''}
                                  onChange={(e) => {
                                    setColumns({ ...columns, [key]: e.target.value });
                                    setPreview(undefined);
                                    setPrepared([]);
                                    setDirty(false);
                                  }}
                                >
                                  <option value="">{uiText('Sin columna')}</option>
                                  {uiText(
                                    headers.map((header) => (
                                      <option key={header}>{uiText(header)}</option>
                                    )),
                                  )}
                                </select>
                              </label>
                            )),
                          )}
                        </div>
                      </details>
                    ),
                  )}
                  {uiText(
                    sheets.length > 0 && (
                      <p className="form-hint">
                        {uiText(fileName)} · {uiText(sheets[sheet]?.rows.length)}
                        {uiText(' filas detectadas')}
                      </p>
                    ),
                  )}
                </>
              ),
            )}
            {uiText(
              busy && (
                <p className="import-progress" role="status">
                  <RefreshCw size={16} className="spin" />
                  {uiText(progress || 'Revisando los datos…')}
                </p>
              ),
            )}
            {uiText(
              error && (
                <p className="form-error" role="alert">
                  {uiText(error)}
                </p>
              ),
            )}
            <div className="import-preview-actions">
              <Button
                variant="secondary"
                disabled={
                  busy || !(source === 'wallet' ? Boolean(wallet) : sheets[sheet]?.rows.length)
                }
                onClick={prepare}
              >
                {uiText(preview ? 'Revisar cambios' : 'Preparar vista previa')}
              </Button>
              <p>{uiText('Las filas no se registran hasta que confirmes la importaci\u00F3n.')}</p>
            </div>
            {uiText(
              preview && (
                <section className="import-preview">
                  <div className="import-preview-heading">
                    <h3>{uiText('Revis\u00E1 lo detectado')}</h3>
                    <span>
                      {uiText(selected.length)}
                      {uiText(' filas seleccionadas')}
                    </span>
                  </div>
                  <p className="form-hint">
                    {uiText(
                      'Las filas con errores o duplicadas quedan excluidas. Pod\u00E9s corregir datos y volver a revisarlos.',
                    )}
                  </p>
                  <div className="table-scroll">
                    <table className="market-table import-table">
                      <thead>
                        <tr>
                          <th>{uiText('Incluir')}</th>
                          <th>{uiText('Activo')}</th>
                          <th>{uiText('Cantidad / saldo')}</th>
                          <th>{uiText('Precio / costo')}</th>
                          <th>{uiText('Fecha')}</th>
                          <th>{uiText('Operaci\u00F3n')}</th>
                          <th>{uiText('Moneda')}</th>
                          <th>{uiText('Comisiones')}</th>
                          <th>{uiText('Referencia')}</th>
                          <th>{uiText('Revisi\u00F3n')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uiText(
                          preview.rows.map((row, index) => {
                            const values = canonicalRow(prepared[index] ?? row.raw);
                            return (
                              <tr key={row.id}>
                                <td>
                                  <input
                                    aria-label={uiText('Incluir fila {0}', [index + 1])}
                                    type="checkbox"
                                    checked={selected.includes(row.id)}
                                    disabled={busy || row.errors.length > 0 || row.duplicate}
                                    onChange={(e) =>
                                      setSelected(
                                        e.target.checked
                                          ? [...selected, row.id]
                                          : selected.filter((id) => id !== row.id),
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <ResearchAssetPicker
                                    label={uiText('Activo de la fila {0}', [index + 1])}
                                    instrument={row.instrument}
                                    onChange={(item) => edit(index, 'instrumentId', item.id)}
                                  />
                                </td>
                                {uiText(
                                  [
                                    'quantity',
                                    'price',
                                    'date',
                                    'type',
                                    'currency',
                                    'fees',
                                    'reference',
                                  ].map((field) => (
                                    <td key={field}>
                                      <input
                                        aria-label={uiText('{0} fila {1}', [field, index + 1])}
                                        value={values[field] ?? ''}
                                        onChange={(e) => edit(index, field, e.target.value)}
                                        disabled={busy}
                                      />
                                    </td>
                                  )),
                                )}
                                <td>
                                  {uiText(
                                    row.errors.map((message) => (
                                      <p className="negative" key={message}>
                                        {uiText(message)}
                                      </p>
                                    )),
                                  )}
                                  {uiText(
                                    row.duplicate && (
                                      <strong>{uiText('Duplicado o sin cambios')}</strong>
                                    ),
                                  )}
                                  {uiText(
                                    row.warnings.map((message) => (
                                      <p key={message}>{uiText(message)}</p>
                                    )),
                                  )}
                                </td>
                              </tr>
                            );
                          }),
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="import-confirm">
                    <p>
                      {uiText(
                        mode === 'holdings'
                          ? 'Se ajustarán las cantidades detectadas. Los activos no incluidos permanecen como están, salvo saldos que ya estaban vinculados a una captura completa de esta wallet.'
                          : 'Se registrarán los movimientos seleccionados, respetando su moneda y el cálculo FIFO.',
                      )}
                    </p>
                    <Button disabled={busy || dirty || !selected.length} onClick={apply}>
                      {uiText('Confirmar importaci\u00F3n')}
                    </Button>
                  </div>
                  {uiText(
                    dirty && (
                      <p className="form-hint">
                        {uiText(
                          'Hay cambios sin revisar. Us\u00E1 Revisar cambios antes de confirmar.',
                        )}
                      </p>
                    ),
                  )}
                </section>
              ),
            )}
          </div>
        ),
      )}
    </Modal>
  );
}
