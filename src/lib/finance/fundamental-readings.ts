import type { FundamentalResearch, ResearchMetric } from '../market/public-fundamentals';
export type FundamentalReading = {
  label: string;
  tone: 'positive' | 'negative' | 'warning' | 'neutral';
  text: string;
};
export function fundamentalReading(
  metric: ResearchMetric,
  research: FundamentalResearch,
): FundamentalReading {
  const latest = research.periods[0],
    prior = latest
      ? research.periods.find(
          (p) =>
            p.currency === latest.currency &&
            Date.parse(latest.date) - Date.parse(p.date) >= 330 * 86400000 &&
            Date.parse(latest.date) - Date.parse(p.date) <= 400 * 86400000,
        )
      : undefined;
  const ids: Record<string, string> = {
    revenue: 'TotalRevenue',
    netIncome: 'NetIncome',
    cashflow: 'OperatingCashFlow',
    fcf: 'FreeCashFlow',
    eps: 'DilutedEPS',
  };
  const before = prior?.values[ids[metric.id]];
  const positive = (label: string, text: string): FundamentalReading => ({
    label,
    tone: 'positive',
    text,
  });
  const negative = (label: string, text: string): FundamentalReading => ({
    label,
    tone: 'negative',
    text,
  });
  if (metric.id === 'growth')
    return metric.value > 0
      ? positive(
          'Ingresos en crecimiento',
          'El negocio vendió más que en el ejercicio anual anterior, en la misma moneda de reporte.',
        )
      : metric.value < 0
        ? negative(
            'Ingresos en retroceso',
            'Las ventas fueron menores que en el ejercicio anual anterior, en la misma moneda de reporte.',
          )
        : {
            label: 'Ventas estables',
            tone: 'neutral',
            text: 'Los ingresos se mantuvieron respecto del ejercicio anterior.',
          };
  if (metric.id === 'margin')
    return metric.value > 0
      ? positive(
          'Margen positivo',
          'Parte de cada 100 de ventas queda como ganancia neta. Un margen mayor significa que conserva más ingresos como resultado.',
        )
      : negative(
          'Margen negativo',
          'Los gastos y demás cargos superaron a los ingresos: el ejercicio terminó con pérdida neta.',
        );
  if (metric.id === 'leverage')
    return {
      label: metric.value > 1 ? 'Deuda mayor al patrimonio' : 'Deuda menor al patrimonio',
      tone: metric.value > 1 ? 'warning' : 'neutral',
      text: 'Mide cuántas unidades de deuda financiera hay por cada unidad de patrimonio. Un valor mayor describe más apalancamiento; su nivel se compara con empresas del mismo sector.',
    };
  if (['netIncome', 'cashflow', 'fcf', 'eps'].includes(metric.id)) {
    const labels =
      metric.id === 'netIncome' || metric.id === 'eps'
        ? ['Con ganancias', 'Con pérdidas']
        : metric.id === 'cashflow'
          ? ['Genera efectivo', 'Consume efectivo']
          : ['Caja libre positiva', 'Caja libre negativa'];
    let text = metric.explanation;
    if (before != null)
      text =
        metric.value > before
          ? 'Mejoró frente al ejercicio anual anterior. ' + text
          : metric.value < before
            ? 'Disminuyó frente al ejercicio anual anterior. ' + text
            : 'Se mantuvo frente al ejercicio anual anterior. ' + text;
    if (metric.value === 0) return { label: 'En equilibrio', tone: 'neutral', text };
    return metric.value > 0
      ? {
          label: before != null && metric.value < before ? 'Positivo, pero en baja' : labels[0],
          tone: before != null && metric.value < before ? 'warning' : 'positive',
          text,
        }
      : negative(labels[1], text);
  }
  if (metric.id === 'revenue' && before != null)
    return metric.value > before
      ? positive(
          'Ventas en crecimiento',
          'Los ingresos superan a los del ejercicio anual anterior.',
        )
      : metric.value < before
        ? negative(
            'Ventas en retroceso',
            'Los ingresos están por debajo del ejercicio anual anterior.',
          )
        : { label: 'Ventas estables', tone: 'neutral', text: metric.explanation };
  return {
    label: research.kind === 'stock' ? 'Dato de contexto' : 'Métrica del activo',
    tone: 'neutral',
    text: metric.explanation,
  };
}
