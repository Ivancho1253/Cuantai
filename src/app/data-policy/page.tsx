import Link from 'next/link';
import { Brand } from '@/components/ui';
export const metadata = { title: 'Datos y transparencia' };
export default function DataPolicy() {
  return (
    <div className="policy-page">
      <header>
        <Brand />
        <Link className="button button-secondary" href="/demo">
          Explorar plataforma
        </Link>
      </header>
      <main>
        <div className="eyebrow">EL MÉTODO CUANTAI</div>
        <h1>
          La confianza empieza
          <br />
          por la transparencia.
        </h1>
        <p className="policy-intro">
          La calidad de una decisión depende de entender de dónde viene la información y cuáles son
          sus límites.
        </p>
        {[
          [
            'Datos demo',
            'El modo demo utiliza series OHLCV sintéticas y reproducibles, fechadas al 14 de marzo de 2025. No representan cotizaciones actuales, recomendaciones ni resultados reales. No se muestran noticias ni balances inventados.',
          ],
          [
            'Fuentes y licencias',
            'Binance proporciona datos spot. Twelve Data habilita búsqueda, cotizaciones e históricos estadounidenses con credenciales. Finnhub proporciona métricas y titulares según cobertura del plan. Cada valor incluye fuente, fecha, moneda y estado. La posibilidad técnica de consultar datos no otorga derechos de redistribución.',
          ],
          [
            'Argentina y CEDEARs',
            'Las especies BYMA en ARS y USD son instrumentos separados del subyacente. El feed BYMA requiere autorización y actualmente admite un archivo normalizado de datos autorizados. No se consulta ni scrapea un endpoint de BYMA sin contrato. Los precios manuales se identifican como tales.',
          ],
          [
            'Indicadores y portfolio',
            'EMA se inicializa con SMA; RSI y ATR utilizan suavizado de Wilder. Los extremos móviles de veinte velas son referencias históricas, no niveles predictivos. El portfolio usa FIFO con decimales de precisión y comisiones. Las conversiones históricas y actuales son independientes. Si falta FX o un precio, el cálculo es incompleto. USDT no se equipara a USD.',
          ],
          [
            'Investigación con IA',
            'La IA recibe evidencia recuperada y métricas determinísticas. La salida estructurada valida fuentes y rechaza cifras narrativas generadas. Esto no garantiza que toda interpretación sea correcta. Sin credenciales se entrega un informe técnico determinístico. No se ejecutan operaciones.',
          ],
          [
            'Privacidad y almacenamiento',
            'Las cuentas, sesiones, preferencias, portfolios y análisis se guardan en la base de datos de esta instalación. En desarrollo se usa PostgreSQL embebido local. Las contraseñas se hashean mediante Better Auth. Si se configura un modelo, el informe de evidencia y la pregunta se envían a su proveedor; las solicitudes OpenAI se envían con store:false. Los datos de cuentas no se adjuntan al análisis individual.',
          ],
          [
            'Alcance de esta versión',
            'La ingesta de estados financieros, DCF, alertas en segundo plano, TWR/XIRR, holdings ETF y herramientas avanzadas de dibujo siguen pendientes. El reporte de cartera es un diagnóstico determinístico de concentración. No es una evaluación exhaustiva de riesgo ni asesoramiento personalizado.',
          ],
        ].map(([title, text], i) => (
          <section key={title}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </section>
        ))}
        <p className="form-hint">
          TradingView Lightweight Charts™ v5.2.1 · Copyright (c) 2026 TradingView, Inc. ·{' '}
          <a href="/licenses/lightweight-charts.txt">Apache License 2.0</a>. La biblioteca gráfica
          conserva su atribución; los datos provienen de los proveedores indicados.
        </p>
        <div className="policy-sources">
          <a
            href="https://www.byma.com.ar/productos/productos-de-datos/market-data/apis"
            target="_blank"
            rel="noreferrer"
          >
            BYMA Market Data ↗
          </a>
          <a
            href="https://tradingview.github.io/lightweight-charts/"
            target="_blank"
            rel="noreferrer"
          >
            Charts by TradingView ↗
          </a>
          <a
            href="https://developers.openai.com/api/docs/guides/structured-outputs"
            target="_blank"
            rel="noreferrer"
          >
            OpenAI Structured Outputs ↗
          </a>
        </div>
      </main>
    </div>
  );
}
