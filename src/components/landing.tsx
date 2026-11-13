'use client';
import { useText as useUiText } from './locale-provider';
import { useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { LanguageSwitcher } from './locale-provider';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDown,
  Activity,
  BookOpen,
  CandlestickChart,
  Check,
  ChevronRight,
  Flame,
  Globe2,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  Newspaper,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';
import { Brand, Modal } from './ui';
import { TradingViewChart } from './tradingview-chart';
import styles from './landing.module.css';
import captureSizes from '../../public/product/capture-sizes.json';
const features = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tag: 'TU PUNTO DE PARTIDA',
    title: 'Tu día. Tus mercados. Todo a la vista.',
    description:
      'Índices de referencia, activos destacados y una cinta que alterna entre Hots y tus favoritos. Encontrá tu foco sin saltar entre pestañas.',
    href: '/demo',
    bullets: ['Resumen de mercados', 'Cinta Hots y Favoritos', 'Accesos a tu investigación'],
  },
  {
    id: 'markets',
    label: 'Mercados',
    icon: Globe2,
    tag: 'DESCUBRÍ TU PRÓXIMA IDEA',
    title: 'Un universo de activos. Un solo buscador.',
    description:
      'Recorré el S&P 500, criptomonedas, ETFs y CEDEARs. Filtrá, compará cotizaciones y abrí la ficha de cada activo con su mercado y moneda.',
    href: '/demo?view=markets',
    bullets: ['Acciones de Estados Unidos', 'Criptomonedas y ETFs', 'Argentina y CEDEARs'],
  },
  {
    id: 'charts',
    label: 'Gráficos',
    icon: CandlestickChart,
    tag: 'LEÉ EL MOVIMIENTO',
    title: 'Acercate al detalle. Ampliá la perspectiva.',
    description:
      'Explorá gráficos de TradingView, cambiá intervalos y combiná herramientas de análisis. Organizá tu terminal con uno, dos o cuatro gráficos.',
    href: '/demo?view=charts',
    bullets: ['Velas e indicadores', 'Distintos intervalos', 'Layouts y pantalla completa'],
  },
  {
    id: 'analyst',
    label: 'Analista',
    icon: Sparkles,
    tag: 'INVESTIGÁ CON MÁS CONTEXTO',
    title: 'Consultá a tus agentes de IA.',
    description:
      'Un espacio para consultar a agentes de IA, pedir orientación y explorar datos. Apoyate en la inteligencia artificial para el análisis fundamental, técnico y de tu portfolio, con evidencia y fuentes a mano.',
    href: '/demo?view=analyst',
    bullets: [
      'Consultas y orientación con IA',
      'Análisis de datos, fundamental y técnico',
      'Evidencia e historial por activo',
    ],
  },
  {
    id: 'research',
    label: 'Investigación',
    icon: BookOpen,
    tag: 'DE LA PREGUNTA A LA EVIDENCIA',
    title: 'Entendé qué hay detrás de cada activo.',
    description:
      'Reuní rendimiento, riesgo, métricas y fuentes. Contrastá escenarios con el analista y conversá sobre cada activo desde su propia ficha.',
    href: '/asset/NASDAQ/NVDA?demo=true',
    bullets: [
      'Análisis técnico y riesgo',
      'Chat por activo',
      'Estados financieros según cobertura',
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: Wallet,
    tag: 'EL VALOR DE VER EL CONJUNTO',
    title: 'Cada posición tiene una historia.',
    description:
      'Registrá movimientos, revisá tus posiciones y entendé la composición de tu patrimonio. Seguí costos, resultados y monedas desde el mismo lugar.',
    href: '/demo?view=portfolio',
    bullets: ['Movimientos y posiciones', 'Costos y resultados', 'Exposición por activo y moneda'],
  },
  {
    id: 'watchlists',
    label: 'Favoritos',
    icon: Star,
    tag: 'TU RADAR PERSONAL',
    title: 'Que tus ideas no se pierdan.',
    description:
      'Guardá activos con la estrella, creá listas para cada estrategia y volvé a lo que te interesa. Tus favoritos también tienen su lugar en la cinta del dashboard.',
    href: '/demo?view=watchlists',
    bullets: ['Listas personalizadas', 'Acceso con una estrella', 'Favoritos en la cinta'],
  },
  {
    id: 'news',
    label: 'Noticias',
    icon: Newspaper,
    tag: 'EL CONTEXTO TAMBIÉN IMPORTA',
    title: 'Más contexto para tus próximas preguntas.',
    description:
      'Consultá titulares de mercado y noticias vinculadas a cada activo, con fecha y enlace a su fuente original cuando el proveedor tenga cobertura.',
    href: '/demo?view=news',
    bullets: ['Titulares por activo', 'Filtros de búsqueda', 'Fecha y fuente original'],
  },
  {
    id: 'settings',
    label: 'Tu espacio',
    icon: Settings2,
    tag: 'HECHO A TU MEDIDA',
    title: 'Tu forma de invertir. Tu espacio de trabajo.',
    description:
      'Configurá tu perfil, tema, moneda de referencia e intereses. Guardá tus listas y la configuración de tus workspaces en tu cuenta.',
    href: '/demo?view=settings',
    bullets: ['Preferencias personales', 'Tema claro y oscuro', 'Workspaces guardados'],
  },
];
const markets = [
  ['NVDA', 'NVIDIA', 'nvda.png'],
  ['AAPL', 'Apple', 'aapl.png'],
  ['BTC', 'Bitcoin', 'btc.svg'],
  ['MSFT', 'Microsoft', 'msft.png'],
  ['ETH', 'Ethereum', 'eth.svg'],
  ['SPY', 'S&P 500', 'spy.png'],
  ['AMZN', 'Amazon', 'amzn.png'],
  ['SOL', 'Solana', 'sol.svg'],
  ['JPM', 'JPMorgan', 'jpm.png'],
];
function SectionBackdrop() {
  return (
    <div className={styles.sectionBackdrop} aria-hidden="true">
      <div className={styles.sectionGlow} />
      <div className={styles.sectionMesh} />
      <svg viewBox="0 0 1440 700" preserveAspectRatio="none" fill="none">
        <g stroke="currentColor" strokeWidth="1">
          <path d="M-140 530C140 530 90 120 365 120S735 610 1010 610s300-330 560-330" />
          <path d="M-140 562C140 562 90 152 365 152S735 642 1010 642s300-330 560-330" />
          <path d="M-140 594C140 594 90 184 365 184S735 674 1010 674s300-330 560-330" />
          <path d="M-80 90C230 90 220 475 560 475S1030 60 1520 60" />
          <path d="M-80 120C230 120 220 505 560 505S1030 90 1520 90" />
        </g>
        <path
          className={styles.connectionFlow}
          d="M-140 530C140 530 90 120 365 120S735 610 1010 610s300-330 560-330"
        />
        <path
          className={styles.connectionFlowReverse}
          d="M-80 120C230 120 220 505 560 505S1030 90 1520 90"
        />
        <g className={styles.connectionNodes}>
          <circle cx="365" cy="120" r="4" />
          <circle cx="1010" cy="610" r="4" />
          <circle cx="560" cy="505" r="3" />
        </g>
      </svg>
    </div>
  );
}
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const uiText = useUiText();
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {uiText(children)}
    </motion.div>
  );
}
function ProductImage({
  name,
  alt,
  preload = false,
}: {
  name: string;
  alt: string;
  preload?: boolean;
}) {
  const uiText = useUiText();
  const dimensions = (
    captureSizes as Record<
      string,
      {
        width: number;
        height: number;
      }
    >
  )[name] ?? {
    width: 1440,
    height: 960,
  };
  return (
    <Image
      src={`/product/${name}.webp`}
      alt={uiText(alt)}
      width={dimensions.width}
      height={dimensions.height}
      unoptimized
      sizes="(max-width: 760px) 100vw, 1120px"
      preload={preload}
      className={styles.productImage}
    />
  );
}
export function Landing() {
  const uiText = useUiText();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [ambientPaused, setAmbientPaused] = useState(false);
  const [expandedImage, setExpandedImage] = useState<{
    name: string;
    label: string;
  } | null>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const feature = features[active];
  const FeatureIcon = feature.icon;
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % features.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + features.length) % features.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = features.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }
  return (
    <div className={`${styles.landing} ${ambientPaused ? styles.paused : ''}`}>
      <a className="skip-link" href="#landing-content">
        {uiText('Ir al contenido')}
      </a>
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientGrid} />
        <span />
        <span />
        <span />
      </div>
      <header className={styles.header}>
        <Brand />
        <nav aria-label={uiText('Producto')}>
          <a href="#funciones">{uiText('Funciones')}</a>
          <a href="#plataforma">{uiText('La plataforma')}</a>
          <a href="#como-funciona">{uiText('C\u00F3mo funciona')}</a>
        </nav>
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          <Link href="/login" className={styles.login}>
            {uiText('Iniciar sesi\u00F3n')}
          </Link>
          <Link href="/register" className={styles.smallCta}>
            {uiText('Crear cuenta ')}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>
      <main id="landing-content">
        <section className={styles.hero}>
          <div className={styles.heroBeams} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className={styles.heroTop}>
            <Reveal className={styles.heroCopy}>
              <a href="#plataforma" className={styles.announcement}>
                <span className={styles.pulse} />
                {uiText(' TUS ACTIVOS Y TUS AGENTES DE IA')}
                {uiText(' ')}
                <ChevronRight size={13} />
              </a>
              <h1>
                {uiText('Tus activos.')}
                <br />
                <span>{uiText('Un solo lugar.')}</span>
              </h1>
              <p>
                {uiText('Para inversores que quieren seguir')}
                {uiText(' ')}
                <strong>{uiText('todos sus activos, centralizados en un mismo lugar.')}</strong>
                {uiText(' Acciones, ETFs, cripto y CEDEARs. Un espacio donde ')}
                <strong>{uiText('consultar a agentes de IA')}</strong>
                {uiText(
                  ' para orientarte, explorar datos y profundizar en an\u00E1lisis fundamental y t\u00E9cnico.',
                )}
              </p>
              <div className={styles.actions}>
                <Link href="/register" className={styles.primaryCta}>
                  {uiText('Centralizar mis activos ')}
                  <ArrowUpRight size={20} />
                </Link>
                <Link href="/demo" className={styles.secondaryCta}>
                  <Play size={14} />
                  {uiText(' Explorar la demo')}
                </Link>
              </div>
              <div className={styles.heroNotes}>
                <span>
                  <Check size={16} />
                  {uiText(' Prob\u00E1 la demo sin registrarte')}
                </span>
                <span>
                  <Check size={16} />
                  {uiText(' Tu forma de invertir, conectada')}
                </span>
              </div>
            </Reveal>
            <div className={styles.heroArt}>
              <Image
                src="/product/connected-assets-muted.webp"
                alt={uiText(
                  'Logo de Cuantai conectando acciones, criptomonedas y otros activos en un centro com\u00FAn',
                )}
                width={1536}
                height={1024}
                sizes="(max-width: 760px) 100vw, 55vw"
                preload
              />
              <div className={styles.assetPills}>
                <span>{uiText('Acciones')}</span>
                <span>{uiText('ETFs')}</span>
                <span>{uiText('Cripto')}</span>
                <span>{uiText('CEDEARs')}</span>
              </div>
            </div>
          </div>
          <div className={styles.productIntro}>
            <span className={styles.eyebrow}>{uiText('AS\u00CD SE VE TENER TODO A MANO')}</span>
            <p>
              {uiText('Una sola vista. ')}
              <strong>{uiText('Todo tu mundo financiero.')}</strong>
            </p>
          </div>
          <div className={styles.heroStage}>
            <motion.div
              className={styles.heroScreen}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <div className={styles.windowBar}>
                <span className={styles.windowDots}>
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <LockKeyhole size={10} />
                  {uiText(' cuantai / tu espacio de trabajo')}
                </span>
                <span className={styles.demoBadge}>{uiText('VISTA DEMO')}</span>
              </div>
              <div className={styles.livePreview}>
                <div className={styles.livePreviewHeading}>
                  <div>
                    <span className={styles.eyebrow}>{uiText('EXPLOR\u00C1 EL MERCADO')}</span>
                    <h3>{uiText('Tu pr\u00F3ximo an\u00E1lisis empieza ac\u00E1.')}</h3>
                    <p>
                      {uiText(
                        'Prob\u00E1 el gr\u00E1fico: cambi\u00E1 el intervalo, acerc\u00E1 el precio o agreg\u00E1 indicadores.',
                      )}
                    </p>
                  </div>
                  <span className={styles.liveBadge}>{uiText('GR\u00C1FICO INTERACTIVO')}</span>
                </div>
                <TradingViewChart symbol="NASDAQ:NVDA" height={640} theme="dark" />
              </div>
            </motion.div>
            <div className={`${styles.floatingNote} ${styles.noteOne}`}>
              <span className={styles.noteIcon}>
                <Flame size={18} />
              </span>
              <div>
                {uiText('El mercado, en movimiento.')}
                <small>
                  {uiText('Explor\u00E1 el gr\u00E1fico con tus propias herramientas.')}
                </small>
              </div>
              <Activity size={25} />
            </div>
            <div className={`${styles.floatingNote} ${styles.noteTwo}`}>
              <span className={styles.noteIcon}>
                <Sparkles size={18} />
              </span>
              <div>
                {uiText('Consult\u00E1 a tus agentes de IA.')}
                <small>
                  {uiText('Datos, orientaci\u00F3n y an\u00E1lisis en un mismo espacio.')}
                </small>
              </div>
            </div>
          </div>
          <div className={styles.heroCaption}>
            <span>
              {uiText('GR\u00C1FICO INTERACTIVO \u00B7 DATOS Y HERRAMIENTAS DE TRADINGVIEW')}
            </span>
            <a href="#funciones">
              {uiText('Hay m\u00E1s por descubrir ')}
              <ArrowDown size={13} />
            </a>
          </div>
        </section>

        <section className={styles.marketBand} aria-label={uiText('Mercados disponibles')}>
          <div className={styles.marketBandLabel}>
            <Globe2 size={15} />
            {uiText(' GLOBAL POR NATURALEZA.')}
            <br />
            <span>{uiText('LOCAL POR CONVICCI\u00D3N.')}</span>
          </div>
          <div className={styles.marketMarquee}>
            <div className={styles.marketTrack}>
              {uiText(
                [false, true].map((copy) => (
                  <div
                    className={styles.marketGroup}
                    key={String(copy)}
                    aria-hidden={copy || undefined}
                  >
                    {uiText(
                      markets.map(([symbol, name, logo]) => (
                        <div className={styles.marketChip} key={symbol}>
                          <Image
                            src={`/asset-logos/${logo}`}
                            alt={uiText('')}
                            width={30}
                            height={30}
                          />
                          <span>
                            {uiText(symbol)}
                            <small>{uiText(name)}</small>
                          </span>
                        </div>
                      )),
                    )}
                  </div>
                )),
              )}
            </div>
          </div>
        </section>

        <section className={styles.explorer} id="plataforma" aria-labelledby="platform-title">
          <SectionBackdrop />
          <Reveal className={styles.sectionHeading}>
            <span className={styles.eyebrow}>
              <span />
              {uiText(' CONOC\u00C9 TU PR\u00D3XIMO WORKSPACE')}
            </span>
            <h2 id="platform-title">
              {uiText('Menos ir de una app a otra.')}
              <br />
              <span>{uiText('M\u00E1s control de tus activos.')}</span>
            </h2>
            <p>
              {uiText(
                'Mir\u00E1 la plataforma por dentro. Eleg\u00ED una funci\u00F3n y descubr\u00ED c\u00F3mo te ayuda a seguir tus inversiones.',
              )}
            </p>
          </Reveal>
          <div
            className={styles.tabList}
            role="tablist"
            aria-label={uiText('Funciones de Cuantai')}
          >
            {uiText(
              features.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`feature-tab-${item.id}`}
                    role="tab"
                    aria-selected={active === index}
                    aria-controls="feature-panel"
                    tabIndex={active === index ? 0 : -1}
                    onClick={() => setActive(index)}
                    onKeyDown={(event) => navigateTabs(event, index)}
                    ref={(element) => {
                      tabs.current[index] = element;
                    }}
                  >
                    <Icon size={15} />
                    {uiText(item.label)}
                    {uiText(
                      active === index && (
                        <motion.span
                          layoutId="active-feature"
                          className={styles.activeTab}
                          transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                        />
                      ),
                    )}
                  </button>
                );
              }),
            )}
          </div>
          <div
            id="feature-panel"
            role="tabpanel"
            aria-labelledby={`feature-tab-${feature.id}`}
            tabIndex={0}
            className={styles.featurePanel}
          >
            <div className={styles.featureCopy}>
              <span className={styles.featureNumber}>
                {uiText(String(active + 1).padStart(2, '0'))} /{' '}
                {uiText(String(features.length).padStart(2, '0'))}
              </span>
              <span className={styles.featureIcon}>
                <FeatureIcon size={24} />
              </span>
              <span className={styles.eyebrow}>{uiText(feature.tag)}</span>
              <h3>{uiText(feature.title)}</h3>
              <p>{uiText(feature.description)}</p>
              <ul>
                {uiText(
                  feature.bullets.map((bullet) => (
                    <li key={bullet}>
                      <Check size={13} />
                      {uiText(bullet)}
                    </li>
                  )),
                )}
              </ul>
              <Link href={feature.href}>
                {uiText('Explorar ')}
                {uiText(feature.label.toLowerCase())} <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className={styles.featureVisual}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={feature.id}
                  initial={reduced ? false : { opacity: 0, x: 25, scale: 0.985 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, x: -15 }}
                  transition={{ duration: 0.24 }}
                >
                  <ProductImage
                    name={feature.id}
                    alt={uiText(
                      'Captura real de {0} en Cuantai, con una cuenta de demostraci\u00F3n',
                      [feature.label],
                    )}
                  />
                </motion.div>
              </AnimatePresence>
              <span className={styles.imageLabel}>
                <span />
                {uiText(' CAPTURA REAL \u00B7 DEMOSTRACI\u00D3N')}
              </span>
              <button
                type="button"
                className={styles.expandCapture}
                onClick={() => setExpandedImage({ name: feature.id, label: feature.label })}
              >
                {uiText('Ampliar captura ')}
                <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        </section>

        <section className={styles.functions} id="funciones" aria-labelledby="functions-title">
          <SectionBackdrop />
          <Reveal className={styles.splitHeading}>
            <div>
              <span className={styles.eyebrow}>
                <span />
                {uiText(' TODO TIENE SU LUGAR')}
              </span>
              <h2 id="functions-title">
                {uiText('Tu seguimiento, completo.')}
                <br />
                <span>{uiText('Tu informaci\u00F3n, conectada.')}</span>
              </h2>
            </div>
            <p>
              {uiText(
                'Desde lo que ya ten\u00E9s hasta tu pr\u00F3xima idea. Un lugar para mirar, investigar y seguir cada inversi\u00F3n.',
              )}
            </p>
          </Reveal>
          <div className={styles.bento}>
            <Reveal className={`${styles.bentoCard} ${styles.chartCard}`}>
              <div className={styles.cardTop}>
                <CandlestickChart size={22} />
                <span>{uiText('01 / EXPLOR\u00C1')}</span>
              </div>
              <h3>{uiText('El gr\u00E1fico es el comienzo.')}</h3>
              <p>
                {uiText(
                  'Herramientas de TradingView, indicadores, distintos intervalos y layouts para seguir m\u00E1s de un activo.',
                )}
              </p>
              <div className={styles.cardScreenshot}>
                <ProductImage
                  name="charts-detail"
                  alt={uiText(
                    'Terminal de Cuantai con herramientas de gr\u00E1ficos de TradingView',
                  )}
                />
              </div>
              <button
                type="button"
                className={styles.expandCapture}
                onClick={() => setExpandedImage({ name: 'charts-detail', label: 'Gráficos' })}
              >
                {uiText('Ampliar captura ')}
                <ArrowUpRight size={15} />
              </button>
              <Link href="/demo?view=charts" className={styles.cardLink}>
                {uiText('Abrir la terminal ')}
                <ArrowUpRight size={16} />
              </Link>
            </Reveal>
            <Reveal className={`${styles.bentoCard} ${styles.researchCard}`} delay={0.08}>
              <div className={styles.cardTop}>
                <Sparkles size={22} />
                <span>{uiText('02 / ENTEND\u00C9')}</span>
              </div>
              <h3>{uiText('Tu investigaci\u00F3n, acompa\u00F1ada por IA.')}</h3>
              <p>
                {uiText(
                  'Consult\u00E1, explor\u00E1 datos y contrast\u00E1 ideas con agentes de IA. Reun\u00ED an\u00E1lisis fundamental, t\u00E9cnico, riesgo y fuentes en la misma investigaci\u00F3n.',
                )}
              </p>
              <div className={styles.cardScreenshot}>
                <ProductImage
                  name="research-detail"
                  alt={uiText(
                    'Ficha de investigaci\u00F3n de NVIDIA en Cuantai con rendimiento, riesgo y conversaci\u00F3n por activo',
                  )}
                />
              </div>
              <button
                type="button"
                className={styles.expandCapture}
                onClick={() =>
                  setExpandedImage({ name: 'research-detail', label: 'Investigación' })
                }
              >
                {uiText('Ampliar captura ')}
                <ArrowUpRight size={15} />
              </button>
              <Link href="/asset/NASDAQ/NVDA?demo=true" className={styles.cardLink}>
                {uiText('Conocer la investigaci\u00F3n ')}
                <ArrowUpRight size={16} />
              </Link>
            </Reveal>
            <Reveal className={`${styles.bentoCard} ${styles.portfolioCard}`}>
              <div className={styles.portfolioCopy}>
                <div className={styles.cardTop}>
                  <Wallet size={22} />
                  <span>{uiText('03 / CONECT\u00C1')}</span>
                </div>
                <h3>
                  {uiText('Tu portfolio.')}
                  <br />
                  <span>{uiText('La historia completa.')}</span>
                </h3>
                <p>
                  {uiText(
                    'De cada movimiento a la visi\u00F3n del conjunto. Posiciones, composici\u00F3n, costos y resultados, con cada moneda en su lugar.',
                  )}
                </p>
                <div className={styles.portfolioTags}>
                  <span>{uiText('Posiciones')}</span>
                  <span>{uiText('Movimientos')}</span>
                  <span>{uiText('Composici\u00F3n')}</span>
                </div>
                <Link href="/demo?view=portfolio" className={styles.cardLink}>
                  {uiText('Explorar el portfolio ')}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className={styles.portfolioScreenshot}>
                <ProductImage
                  name="portfolio-detail"
                  alt={uiText(
                    'Portfolio real de demostraci\u00F3n con posiciones, costos, resultados y composici\u00F3n por activo',
                  )}
                />
                <button
                  type="button"
                  className={styles.expandCapture}
                  onClick={() => setExpandedImage({ name: 'portfolio-detail', label: 'Portfolio' })}
                >
                  {uiText('Ampliar captura ')}
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </Reveal>
          </div>
          <div className={styles.detailGrid}>
            {uiText(
              [
                {
                  icon: Flame,
                  title: 'Hots o tus favoritos',
                  text: 'Una cinta que acompaña el mercado y puede mostrar los activos que vos seguís.',
                  href: '/demo',
                },
                {
                  icon: BookOpen,
                  title: 'Estados financieros',
                  text: 'Compará estados anuales y consultá las fuentes y períodos disponibles por empresa.',
                  href: '/asset/NASDAQ/AAPL?demo=true',
                },
                {
                  icon: Layers3,
                  title: 'CEDEARs y monedas',
                  text: 'Encontrá las especies locales sin confundir su cotización con la del subyacente.',
                  href: '/demo?view=markets',
                },
                {
                  icon: Newspaper,
                  title: 'Noticias con origen',
                  text: 'Titulares por mercado y por activo, con fecha y enlace a la publicación original.',
                  href: '/demo?view=news',
                },
              ].map(({ icon: Icon, title, text, href }, index) => (
                <Reveal key={title} delay={index * 0.06} className={styles.detailCard}>
                  <Icon size={21} />
                  <h3>{uiText(title)}</h3>
                  <p>{uiText(text)}</p>
                  <Link href={href} aria-label={uiText('Explorar {0}', [title.toLowerCase()])}>
                    <ArrowUpRight size={18} />
                  </Link>
                </Reveal>
              )),
            )}
          </div>
        </section>

        <section className={styles.workflow} id="como-funciona" aria-labelledby="workflow-title">
          <SectionBackdrop />
          <Reveal className={styles.sectionHeading}>
            <span className={styles.eyebrow}>
              <span />
              {uiText(' DE LA CURIOSIDAD A TU WORKSPACE')}
            </span>
            <h2 id="workflow-title">
              {uiText('Entr\u00E1 con una pregunta.')}
              <br />
              <span>{uiText('Sal\u00ED con m\u00E1s perspectiva.')}</span>
            </h2>
          </Reveal>
          <div className={styles.steps}>
            {uiText(
              [
                [
                  '01',
                  'Explorá sin compromiso.',
                  'Abrí la demo y recorré las herramientas. No necesitás una cuenta para conocer la plataforma.',
                ],
                [
                  '02',
                  'Hacé lugar a tus ideas.',
                  'Creá tu cuenta, armá tus listas y configurá tu espacio según tus intereses.',
                ],
                [
                  '03',
                  'Conectá tu universo.',
                  'Investigá activos, registrá tu portfolio y volvé a tus workspaces cuando lo necesites.',
                ],
              ].map(([number, title, text], index) => (
                <Reveal className={styles.step} key={number} delay={index * 0.12}>
                  <span>{uiText(number)}</span>
                  <h3>{uiText(title)}</h3>
                  <p>{uiText(text)}</p>
                </Reveal>
              )),
            )}
          </div>
        </section>

        <Reveal className={styles.finalCta}>
          <SectionBackdrop />
          <div className={styles.ctaOrbit} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span className={styles.eyebrow}>
            {uiText('TU PR\u00D3XIMA PERSPECTIVA EMPIEZA AC\u00C1')}
          </span>
          <h2>
            {uiText('Tus activos, juntos.')}
            <br />
            <span>{uiText('La IA, a tu lado.')}</span>
          </h2>
          <p>
            {uiText(
              'Un lugar para seguir tus inversiones y consultar a agentes de IA sobre datos, ideas y an\u00E1lisis.',
            )}
          </p>
          <div className={styles.actions}>
            <Link href="/register" className={styles.primaryCta}>
              {uiText('Crear mi espacio ')}
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/demo" className={styles.secondaryCta}>
              {uiText('Primero, la demo ')}
              <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </main>
      <Modal
        open={Boolean(expandedImage)}
        onOpenChange={(open) => {
          if (!open) setExpandedImage(null);
        }}
        title={uiText(
          expandedImage ? `${expandedImage.label} · captura ampliada` : 'Captura ampliada',
        )}
        description={uiText(
          'Panel real de una cuenta de demostraci\u00F3n. Pod\u00E9s recorrer la imagen en su tama\u00F1o original.',
        )}
        className={styles.captureModal}
      >
        {uiText(
          expandedImage && (
            <div className={styles.expandedCapture}>
              <ProductImage
                name={expandedImage.name}
                alt={uiText('Vista ampliada de {0}', [expandedImage.label])}
              />
            </div>
          ),
        )}
      </Modal>
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div>
            <Brand />
            <p>{uiText('Una nueva perspectiva de tus inversiones.')}</p>
          </div>
          <div>
            <a href="#plataforma">{uiText('La plataforma')}</a>
            <Link href="/data-policy">
              {uiText('Datos y transparencia ')}
              <ArrowUpRight size={12} />
            </Link>
            <Link href="/login">{uiText('Tu cuenta')}</Link>
          </div>
          <button
            className={styles.motionToggle}
            onClick={() => setAmbientPaused((value) => !value)}
            aria-label={uiText(
              ambientPaused ? 'Activar animaciones de fondo' : 'Pausar animaciones de fondo',
            )}
          >
            {uiText(ambientPaused ? <Play size={13} /> : <Pause size={13} />)}
            {uiText(' Animaciones')}
            {uiText(' ')}
            {uiText(ambientPaused ? 'pausadas' : 'activadas')}
          </button>
        </div>
        <div className={styles.footerBottom}>
          <span>
            © {uiText(new Date().getFullYear())}
            {uiText(' Cuantai')}
            <a
              className={styles.developerCredit}
              href="https://www.linkedin.com/in/ivangcabrera/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dev by Ivan Cabrera
            </a>
          </span>
          <p>
            {uiText(
              'Capturas de una cuenta de demostraci\u00F3n. Los precios de Cuantai en las capturas son sint\u00E9ticos; los gr\u00E1ficos de TradingView usan su propia fuente. La cobertura de cotizaciones, noticias, estados financieros e IA depende de los proveedores configurados. Herramientas de investigaci\u00F3n y seguimiento, sin ejecuci\u00F3n de operaciones.',
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
