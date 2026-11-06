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
            'Logos e identidad visual',
            'Los logos identifican a las empresas, administradoras de fondos y proyectos cripto. Los CEDEARs muestran la marca del emisor subyacente y las monedas tradicionales usan símbolos monetarios. Las marcas pertenecen a sus titulares; su presencia no implica afiliación. El catálogo inicial utiliza imágenes locales y los activos nuevos consultan las fuentes de logos según cobertura. Cuando una imagen no está disponible se muestra un ícono neutro.',
          ],
          [
            'Gráficos oficiales de TradingView',
            'Los gráficos de precios usan el widget oficial y los datos de TradingView, también al explorar la demo. Cuantai no les envía velas ni calcula sus indicadores. La cobertura y la demora dependen de TradingView y del mercado. Los precios de tablas, cálculos de cartera e investigación usan sus proveedores propios y no se extraen del widget. Se guarda la configuración de apertura; no se guardan en Cuantai los dibujos o cambios internos del widget.',
          ],
          [
            'Estados financieros',
            'Financials muestra una selección de conceptos anuales US-GAAP de SEC EDGAR, mediante consulta identificada o archivo importado. Cada columna conserva un período fiscal, una versión y su presentación de origen. No se mezclan comparativos de documentos posteriores, períodos trimestrales ni cifras en distintas monedas. Los valores ausentes no se estiman. El flujo libre simplificado se identifica como un cálculo y no se aplica al sector financiero. Esta selección no reemplaza los estados completos ni sus notas.',
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
            'La conciliación trimestral y de reexpresiones comparativas, IFRS, DCF, alertas en segundo plano, TWR/XIRR, holdings ETF y herramientas avanzadas de dibujo siguen pendientes. El reporte de cartera es un diagnóstico determinístico de concentración. No es una evaluación exhaustiva de riesgo ni asesoramiento personalizado.',
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
          Los widgets oficiales conservan la atribución a TradingView y se conectan a sus dominios.
          No se incluye información de tu cuenta, cartera ni credenciales en la configuración del
          gráfico. La integración utiliza el widget público de TradingView y está sujeta a su
          disponibilidad y políticas.
        </p>
        <div className="policy-sources">
          <a
            href="https://site.financialmodelingprep.com/developer/docs/company-image-api"
            target="_blank"
            rel="noreferrer"
          >
            Logos de empresas · FMP ↗
          </a>
          <a href="https://github.com/spothq/cryptocurrency-icons" target="_blank" rel="noreferrer">
            Cryptocurrency Icons ↗
          </a>
          <a
            href="https://www.byma.com.ar/productos/productos-de-datos/market-data/apis"
            target="_blank"
            rel="noreferrer"
          >
            BYMA Market Data ↗
          </a>
          <a
            href="https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/"
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
