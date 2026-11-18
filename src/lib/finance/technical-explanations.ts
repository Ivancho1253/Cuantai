import type { ChartIndicatorData } from './chart-indicators';
export type IndicatorExplanation = {
  label: string;
  summary: string;
  meaning: string;
  watch: string;
  source: string;
};

export function technicalExplanations(
  data?: ChartIndicatorData,
): Record<'rsi' | 'macd' | 'trend' | 'levels', IndicatorExplanation> {
  const unavailable =
    'Faltan cierres diarios para calcular esta lectura. No se puede deducir una dirección.';
  const rsiValue = data?.rsi.value;
  const fast = data?.config?.fast ?? 20;
  const slow = data?.config?.slow ?? 50;
  const rsiLabel =
    rsiValue == null
      ? 'No disponible'
      : rsiValue > 55
        ? 'Alcista'
        : rsiValue < 45
          ? 'Bajista'
          : 'Neutral';
  const stateLabel = (state?: string) =>
    state === 'bullish'
      ? 'Alcista'
      : state === 'bearish'
        ? 'Bajista'
        : state === 'neutral'
          ? 'Neutral'
          : 'No disponible';
  return {
    rsi: {
      label: rsiLabel,
      summary:
        rsiValue == null
          ? unavailable
          : rsiValue <= 30
            ? 'Sobreventa · impulso bajista intenso. El RSI está en 30 o menos: la fuerza de las caídas domina a la de las subas en el período analizado.'
            : rsiValue >= 70
              ? 'Sobrecompra · impulso alcista intenso. El RSI está en 70 o más: la fuerza de las subas domina a la de las caídas en el período analizado.'
              : rsiValue > 55
                ? 'No está en sobrecompra ni sobreventa. Las subas recientes pesan más que las caídas: el impulso es alcista.'
                : rsiValue < 45
                  ? 'No está en sobrecompra ni sobreventa. Las caídas recientes pesan más que las subas: el impulso es bajista.'
                  : 'No está en sobrecompra ni sobreventa. Subas y caídas están relativamente equilibradas: el impulso es neutral.',
      meaning:
        'El RSI compara la fuerza de las subas y las caídas de los últimos cierres del período indicado. Va de 0 a 100: hasta 30 se considera sobreventa; desde 70, sobrecompra.',
      watch:
        'Sobreventa describe presión vendedora extrema; sobrecompra, presión compradora extrema. El RSI mide impulso, mientras que las EMA describen tendencia y los soportes y resistencias ubican el precio.',
      source:
        'https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/',
    },
    macd: {
      label: stateLabel(data?.macd.state),
      summary:
        data?.macd.state === 'bullish'
          ? data.macd.line !== null && data.macd.line < 0
            ? 'El MACD está sobre su señal: mejora el impulso. Como la línea sigue bajo cero, esa mejora todavía convive con una tendencia de fondo débil.'
            : 'Lectura alcista: la línea MACD está por encima de su señal y el histograma es positivo. Según este indicador, domina el impulso comprador.'
          : data?.macd.state === 'bearish'
            ? 'Lectura bajista: la línea MACD está por debajo de su señal y el histograma es negativo. Según este indicador, domina el impulso vendedor.'
            : data?.macd.state === 'neutral'
              ? 'MACD y señal están prácticamente al mismo nivel: no hay ventaja clara de impulso.'
              : unavailable,
      meaning:
        'El MACD compara medias rápida y lenta con su señal (períodos indicados en la tarjeta). El histograma es la diferencia entre la línea MACD y su señal: positivo por encima, negativo por debajo.',
      watch:
        'Un cruce del MACD con su señal habla del impulso. Un cruce de la línea MACD por cero habla de la relación entre las medias rápida y lenta del horizonte. Son lecturas distintas.',
      source:
        'https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/',
    },
    trend: {
      label: stateLabel(data?.trend.state),
      summary:
        data?.trend.state === 'bullish'
          ? data.close != null && data.trend.fast != null && data.close < data.trend.fast
            ? 'La media corta está sobre la media larga, pero el cierre quedó bajo la media corta. Hay sesgo alcista con un retroceso reciente.'
            : 'La media corta está sobre la media larga: los precios recientes son más altos que su referencia lenta del horizonte elegido. La tendencia es alcista.'
          : data?.trend.state === 'bearish'
            ? 'La media corta está bajo la media larga: los precios recientes son más bajos que su referencia lenta del horizonte elegido. La tendencia es bajista.'
            : data?.trend.state === 'neutral'
              ? 'Las medias del horizonte están muy cerca: su separación es de hasta 0,5%. La tendencia se clasifica como neutral.'
              : unavailable,
      meaning: `Una EMA pondera más los cierres recientes. En este horizonte se comparan EMA ${fast} y EMA ${slow}; la EMA 200 agrega la referencia de fondo.`,
      watch:
        'La EMA corta resume los precios recientes y la larga establece la referencia del horizonte elegido. Corta sobre larga: estructura alcista; corta bajo larga: estructura bajista. La EMA 200 describe la tendencia de fondo.',
      source:
        'https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/ema',
    },
    levels: {
      label:
        data?.levels?.state === 'above_resistance'
          ? 'Alcista'
          : data?.levels?.state === 'below_support'
            ? 'Bajista'
            : data?.levels?.state && data.levels.state !== 'unavailable'
              ? 'Neutral'
              : 'No disponible',
      summary:
        data?.levels?.state === 'above_resistance'
          ? 'Ruptura alcista: el último cierre está por encima del máximo del período de referencia. El precio superó la zona superior del rango.'
          : data?.levels?.state === 'below_support'
            ? 'Ruptura bajista: el último cierre está por debajo del mínimo del período de referencia. El precio perdió la zona inferior del rango.'
            : data?.levels?.state === 'near_support'
              ? 'Zona de soporte: el cierre está a menos de 1% del piso del rango. Es el extremo inferior de los precios observados y una referencia de demanda en la teoría técnica.'
              : data?.levels?.state === 'near_resistance'
                ? 'Zona de resistencia: el cierre está a menos de 1% del techo del rango. Es el extremo superior de los precios observados y una referencia de oferta en la teoría técnica.'
                : data?.levels?.state === 'within_range'
                  ? 'Dentro del rango: el cierre está entre soporte y resistencia. La lectura de estos niveles es neutral porque el precio permanece dentro de sus extremos previos.'
                  : unavailable,
      meaning:
        'Soporte: zona inferior asociada a demanda. Resistencia: zona superior asociada a oferta. Un cierre por encima de la resistencia se clasifica como ruptura alcista; por debajo del soporte, ruptura bajista.',
      watch:
        'Cuantai toma el mínimo y el máximo de las velas anteriores al último cierre. El horizonte elegido determina la ventana: 20, 60 o 200 sesiones. El último cierre se excluye del rango para identificar rupturas.',
      source:
        'https://www.fidelity.com/learning-center/trading-investing/technical-analysis/support-and-resistance',
    },
  };
}
