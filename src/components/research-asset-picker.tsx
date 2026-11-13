'use client';
import { useText as useUiText } from './locale-provider';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search } from 'lucide-react';
import { api } from '@/lib/utils';
import type { Instrument } from '@/lib/market/types';
import { AssetIcon, ErrorState, Modal } from './ui';
export function ResearchAssetPicker({
  instrument,
  onChange,
  label = 'Activo para analizar',
}: {
  instrument?: Instrument;
  label?: string;
  onChange: (instrument: Instrument) => void;
}) {
  const uiText = useUiText();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 180);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useQuery({
    queryKey: ['research-assets', search],
    queryFn: () =>
      api<{
        instruments: Instrument[];
      }>(`instruments?q=${encodeURIComponent(search)}`),
    enabled: open,
  });
  return (
    <>
      <button
        className="research-picker"
        aria-label={uiText(label)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {uiText(instrument && <AssetIcon instrument={instrument} />)}
        <span>
          <strong>{uiText(instrument?.symbol ?? 'Elegir activo')}</strong>
          <small>{uiText(instrument?.name ?? 'Especie pendiente de identificar')}</small>
        </span>
        <span className="research-exchange">{uiText(instrument?.exchange)}</span>
        <ChevronDown size={16} />
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={uiText('Elegir activo')}
        description={uiText(
          'Busc\u00E1 acciones, ETFs, criptomonedas y CEDEARs por nombre o ticker.',
        )}
        className="research-picker-modal"
      >
        <label className="research-picker-search">
          <Search size={18} />
          <input
            autoFocus
            aria-label={uiText('Buscar activo para analizar')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={uiText('Ticker o nombre de empresa')}
          />
        </label>
        <div className="research-picker-results">
          {uiText(
            results.isPending ? (
              <p role="status">{uiText('Buscando activos\u2026')}</p>
            ) : results.isError ? (
              <ErrorState message={results.error.message} retry={() => results.refetch()} />
            ) : (
              results.data?.instruments
                .filter((i) => i.type !== 'cash')
                .slice(0, 60)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onChange(item);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <AssetIcon instrument={item} />
                    <span>
                      <strong>{uiText(item.symbol)}</strong>
                      <small>{uiText(item.name)}</small>
                    </span>
                    <small>
                      {uiText(item.exchange)} · {uiText(item.currency)}
                    </small>
                  </button>
                ))
            ),
          )}
          {uiText(
            results.data?.instruments.length === 0 && (
              <p>{uiText('No encontramos ese activo. Prob\u00E1 otro ticker o nombre.')}</p>
            ),
          )}
        </div>
      </Modal>
    </>
  );
}
