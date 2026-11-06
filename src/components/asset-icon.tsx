'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Building2, Coins, Landmark, Layers3 } from 'lucide-react';
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
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const displayLogo = logo && !failed;
  const description = logo
    ? `${instrument.type === 'cash' && instrument.currency !== 'USDT' ? 'Símbolo' : 'Logo'} de ${logo.name}`
    : '';
  const Fallback =
    instrument.type === 'cash'
      ? Landmark
      : instrument.type === 'crypto'
        ? Coins
        : instrument.type === 'etf' || instrument.type === 'index'
          ? Layers3
          : Building2;
  return (
    <span
      className={cn('asset-icon', small && 'small', displayLogo && 'asset-icon-logo')}
      data-instrument-id={instrument.id}
      data-logo-state={!displayLogo ? 'fallback' : loaded ? 'loaded' : 'loading'}
      style={{
        color: instrument.color,
        background: displayLogo ? logo.background : `${instrument.color}16`,
      }}
      title={displayLogo ? description : `${instrument.name} · logo no disponible`}
    >
      {displayLogo ? (
        <Image
          src={logo.src}
          alt={description}
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
          aria-label={`${instrument.name} · logo no disponible`}
        >
          <Fallback size={small ? 16 : 21} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
