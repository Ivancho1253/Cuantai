'use client';
import { useText as useUiText } from './locale-provider';
import Image from 'next/image';
import { useState } from 'react';
import type { Instrument } from '@/lib/market/types';
import { assetLogo, type AssetLogo } from '@/lib/market/logos';
import { cn } from '@/lib/utils';
export function AssetIcon({
  instrument,
  small = false,
}: {
  instrument: Instrument;
  small?: boolean;
}) {
  const logo = assetLogo(instrument);
  // Changing the listing resets image failure state, including reused rows/selectors.
  return (
    <AssetLogoImage
      key={`${instrument.id}:${logo?.src ?? ''}`}
      instrument={instrument}
      logo={logo}
      small={small}
    />
  );
}
function AssetLogoImage({
  instrument,
  logo,
  small,
}: {
  instrument: Instrument;
  logo: AssetLogo | null;
  small: boolean;
}) {
  const uiText = useUiText();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const displayLogo = logo && !failed;
  const description = logo
    ? `${instrument.type === 'cash' && instrument.currency !== 'USDT' ? 'Símbolo' : 'Logo'} de ${logo.name}`
    : '';
  return (
    <span
      className={cn('asset-icon', small && 'small', displayLogo && 'asset-icon-logo')}
      data-instrument-id={instrument.id}
      data-logo-state={!displayLogo ? 'fallback' : loaded ? 'loaded' : 'loading'}
      style={{
        color: instrument.color,
        background: displayLogo ? logo.background : `${instrument.color}16`,
      }}
      title={uiText(displayLogo ? description : `${instrument.name} · logo no disponible`)}
    >
      {uiText(
        displayLogo ? (
          <Image
            src={logo.src}
            alt={uiText(description)}
            width={64}
            height={64}
            unoptimized
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            className="asset-icon-fallback"
            role="img"
            aria-label={uiText('{0} \u00B7 logo no disponible', [instrument.name])}
          >
            <span className="asset-monogram" aria-hidden="true">
              {instrument.symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 3)}
            </span>
          </span>
        ),
      )}
    </span>
  );
}
