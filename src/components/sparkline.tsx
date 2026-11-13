'use client';
import { useText as useUiText } from './locale-provider';
import { useId } from 'react';
export function Sparkline({
  values,
  positive = true,
  fill = false,
}: {
  values: number[];
  positive?: boolean;
  fill?: boolean;
}) {
  const uiText = useUiText();
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return <span className="muted">—</span>;
  const min = Math.min(...values),
    max = Math.max(...values);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 140},${36 - ((v - min) / (max - min || 1)) * 30}`)
    .join(' ');
  const color = positive ? '#4bc7a5' : '#dc7e8b';
  return (
    <svg className="sparkline" viewBox="0 0 140 42" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {uiText(fill && <polygon points={`0,42 ${points} 140,42`} fill={`url(#${id})`} />)}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
