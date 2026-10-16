'use client';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api, dateLabel, number } from '@/lib/utils';
export function CedearRatio({ instrumentId }: { instrumentId: string }) {
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
      {ratio ? (
        <>
          <strong>
            Ratio vigente: {number(ratio.certificatesPerShare, 4)} certificados por acción
            subyacente.
          </strong>{' '}
          Vigente desde {dateLabel(ratio.effectiveFrom)}.{' '}
          <a href={ratio.source} target="_blank" rel="noreferrer">
            Fuente del ratio <ExternalLink size={10} />
          </a>{' '}
          La valuación de la posición usa el precio del certificado; el ratio se aplica solo a la
          exposición equivalente.
        </>
      ) : data.isError ? (
        'No se pudo consultar el historial de ratios.'
      ) : (
        'Sin ratio vigente verificado en el catálogo. La exposición equivalente queda sin calcular.'
      )}
    </div>
  );
}
