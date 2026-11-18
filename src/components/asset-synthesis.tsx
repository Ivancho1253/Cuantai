'use client';
import { Layers3, Check, ArrowDownRight, BookOpen, ArrowRight } from 'lucide-react';
import { useText, useLocale } from './locale-provider';
import { useFundamentalResearch } from './fundamental-research';
import { useChartIndicatorData } from './use-chart-indicators';
import { assetSynthesis } from '@/lib/finance/asset-synthesis';
import { technicalHorizons, type TechnicalHorizon } from '@/lib/finance/chart-indicators';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import type { Instrument } from '@/lib/market/types';
export function AssetSynthesis({
  instrument,
  horizon,
  overview,
}: {
  instrument: Instrument;
  horizon: TechnicalHorizon;
  overview?: AssetOverview;
}) {
  const t = useText(),
    { locale } = useLocale();
  const fundamental = useFundamentalResearch(instrument.id),
    technical = useChartIndicatorData(instrument.id, horizon);
  const d = assetSynthesis({ fundamentals: fundamental.data, technical: technical.data, overview });
  const date = (value: string) =>
    new Date(value).toLocaleDateString(
      locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR',
      { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
    );
  return (
    <section
      className="panel asset-synthesis"
      id="asset-conclusion"
      aria-label={t('Conclusión general del activo')}
      data-tone={d.tone}
    >
      <div className="asset-synthesis-heading">
        <div className="asset-synthesis-icon">
          <Layers3 size={25} />
        </div>
        <div>
          <span className="asset-overline">{t('CONECTÁ LOS DATOS')}</span>
          <h2>{t('Conclusión general')}</h2>
        </div>
        <span className="synthesis-method">{t('Síntesis calculada con datos')}</span>
      </div>
      {!fundamental.data && !technical.data && !overview ? (
        <p role="status">{t('Reuniendo la evidencia del activo…')}</p>
      ) : (
        <>
          <h3>{t(d.title)}</h3>
          <p className="asset-synthesis-description">
            {d.summary.map((text) => t(text)).join(' ')}
          </p>
          <div className="synthesis-pillars">
            {[
              ['Negocio', d.fundamentalLabel, d.fundamentalTone],
              [technicalHorizons[horizon].label, d.technicalLabel, d.technicalTone],
              ['Riesgo', d.riskLabel, d.riskTone],
            ].map(([label, value, tone]) => (
              <div key={label} data-tone={tone}>
                <span>{t(label)}</span>
                <strong>{t(value)}</strong>
              </div>
            ))}
          </div>
          <div className="synthesis-evidence-columns">
            <div className="synthesis-strengths">
              <h4>
                <Check size={18} />
                {t('Lo que acompaña')}
              </h4>
              {d.strengths.length ? (
                <ul>
                  {d.strengths.map((f) => (
                    <li key={f.text}>
                      <Check size={14} />
                      <span>{t(f.text)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {t(
                    'Las métricas disponibles no aportan una fortaleza concluyente para esta síntesis.',
                  )}
                </p>
              )}
            </div>
            <div className="synthesis-attention">
              <h4>
                <ArrowDownRight size={18} />
                {t('Lo que requiere atención')}
              </h4>
              {d.attention.length ? (
                <ul>
                  {d.attention.map((f) => (
                    <li key={f.text} data-tone={f.tone}>
                      <ArrowDownRight size={14} />
                      <span>{t(f.text)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {t(
                    'No se detecta una debilidad adicional en las métricas evaluadas. Revisá también la cobertura de datos.',
                  )}
                </p>
              )}
            </div>
          </div>
          {d.missing.length > 0 && (
            <details className="synthesis-coverage">
              <summary>
                <BookOpen size={15} />
                {t('Datos que faltan para completar la lectura')}
              </summary>
              {d.missing.map((text) => (
                <p key={text}>{t(text)}</p>
              ))}
            </details>
          )}
          <div className="synthesis-footer">
            <div>
              {fundamental.data?.asOf && (
                <span>
                  {t('Fundamentos')}: {date(fundamental.data.asOf)}
                </span>
              )}
              {fundamental.data?.earnings && (
                <span>
                  {t('Último trimestre informado')}: {fundamental.data.earnings.period}
                </span>
              )}
              {technical.data?.asOf && (
                <span>
                  {t('Lectura técnica')}: {date(technical.data.asOf)}
                </span>
              )}
            </div>
            <a href="#asset-chat">
              {t('Preguntar sobre esta lectura')}
              <ArrowRight size={16} />
            </a>
          </div>
        </>
      )}
    </section>
  );
}
