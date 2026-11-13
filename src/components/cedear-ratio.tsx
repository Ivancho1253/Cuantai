'use client';
import { useText as useUiText } from './locale-provider';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api, dateLabel, number } from '@/lib/utils';
export function CedearRatio({ instrumentId }: { instrumentId: string }) {
  const uiText = useUiText();
  const data = useQuery({
    queryKey: ['cedear-ratios', instrumentId],
    queryFn: () =>
      api<
        {
          certificatesPerShare: string;
          effectiveFrom: string;
          source: string;
          retrievedAt: string;
        }[]
      >(`cedear-ratios?id=${encodeURIComponent(instrumentId)}`),
  });
  const ratio = data.data?.[0];
  return (
    <div className="info-strip">
      {uiText(
        ratio ? (
          <>
            <strong>
              {uiText('Ratio vigente: ')}
              {uiText(number(ratio.certificatesPerShare, 4))}
              {uiText(' certificados por acci\u00F3n subyacente.')}
            </strong>
            {uiText(' ')}
            {uiText('Vigente desde ')}
            {uiText(dateLabel(ratio.effectiveFrom))}.{uiText(' ')}
            <a href={ratio.source} target="_blank" rel="noreferrer">
              {uiText('Fuente del ratio ')}
              <ExternalLink size={10} />
            </a>
            {uiText(' ')}
            {uiText(
              'La valuaci\u00F3n de la posici\u00F3n usa el precio del certificado; el ratio se aplica solo a la exposici\u00F3n equivalente.',
            )}
          </>
        ) : data.isError ? (
          'No se pudo consultar el historial de ratios.'
        ) : (
          'Sin ratio vigente verificado en el catálogo. La exposición equivalente queda sin calcular.'
        ),
      )}
    </div>
  );
}
