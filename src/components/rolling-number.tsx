'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Decimal from 'decimal.js';
import { useLocale } from './locale-provider';

/** Animate changed digits once per quote; never manufacture intermediate prices. */
export function RollingNumber({ value }: { value: string | null | undefined }) {
  const reducedMotion = useReducedMotion();
  const { locale } = useLocale();
  const normalized = value ?? null;
  const [sample, setSample] = useState({ current: normalized, previous: normalized });
  if (sample.current !== normalized) {
    setSample({ current: normalized, previous: sample.current });
  }
  const direction =
    sample.current !== null && sample.previous !== null
      ? new Decimal(sample.current).cmp(sample.previous)
      : 0;
  const formatted =
    normalized === null
      ? '—'
      : new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(normalized));
  return (
    <span
      className="rolling-number"
      data-value={normalized ?? ''}
      data-direction={direction > 0 ? 'up' : direction < 0 ? 'down' : 'unchanged'}
    >
      <span className="sr-only">{formatted}</span>
      <span className="rolling-digits" aria-hidden="true">
        {Array.from(formatted).map((char, index) =>
          /\d/.test(char) ? (
            <span className="rolling-digit" key={formatted.length - index}>
              <AnimatePresence initial={false} custom={direction}>
                <motion.span
                  key={char}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({
                      y: reducedMotion || !d ? '0%' : d > 0 ? '110%' : '-110%',
                    }),
                    exit: (d: number) => ({
                      y: reducedMotion || !d ? '0%' : d > 0 ? '-110%' : '110%',
                    }),
                  }}
                  initial="enter"
                  animate={{ y: '0%' }}
                  exit="exit"
                  transition={{
                    duration: reducedMotion || !direction ? 0 : 0.65,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {char}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : (
            <span className="rolling-separator" key={formatted.length - index}>
              {char}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
