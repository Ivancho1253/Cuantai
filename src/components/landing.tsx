'use client';

import { useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import Link from 'next/link';
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
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
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
  const dimensions = (captureSizes as Record<string, { width: number; height: number }>)[name] ?? {
    width: 1440,
    height: 960,
  };
  return (
    <Image
      src={`/product/${name}.webp`}
      alt={alt}
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
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [ambientPaused, setAmbientPaused] = useState(false);
  const [expandedImage, setExpandedImage] = useState<{ name: string; label: string } | null>(null);
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
        Ir al contenido
      </a>
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientGrid} />
        <span />
        <span />
        <span />
      </div>
      <header className={styles.header}>
        <Brand />
        <nav aria-label="Producto">
          <a href="#funciones">Funciones</a>
          <a href="#plataforma">La plataforma</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>
        <div className={styles.headerActions}>
          <Link href="/login" className={styles.login}>
            Iniciar sesión
          </Link>
          <Link href="/register" className={styles.smallCta}>
            Crear cuenta <ArrowUpRight size={14} />
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
                <span className={styles.pulse} /> TUS ACTIVOS Y TUS AGENTES DE IA{' '}
                <ChevronRight size={13} />
              </a>
              <h1>
                Tus activos.
                <br />
                <span>Un solo lugar.</span>
              </h1>
              <p>
                Para inversores que quieren seguir{' '}
                <strong>todos sus activos, centralizados en un mismo lugar.</strong> Acciones, ETFs,
                cripto y CEDEARs. Un espacio donde <strong>consultar a agentes de IA</strong> para
                orientarte, explorar datos y profundizar en análisis fundamental y técnico.
              </p>
              <div className={styles.actions}>
                <Link href="/register" className={styles.primaryCta}>
                  Centralizar mis activos <ArrowUpRight size={20} />
                </Link>
                <Link href="/demo" className={styles.secondaryCta}>
                  <Play size={14} /> Explorar la demo
                </Link>
              </div>
              <div className={styles.heroNotes}>
                <span>
                  <Check size={16} /> Probá la demo sin registrarte
                </span>
                <span>
                  <Check size={16} /> Tu forma de invertir, conectada
                </span>
              </div>
            </Reveal>
            <div className={styles.heroArt}>
              <Image
                src="/product/connected-assets-muted.webp"
                alt="Logo de Cuantai conectando acciones, criptomonedas y otros activos en un centro común"
                width={1536}
                height={1024}
                sizes="(max-width: 760px) 100vw, 55vw"
                preload
              />
              <div className={styles.assetPills}>
                <span>Acciones</span>
                <span>ETFs</span>
                <span>Cripto</span>
                <span>CEDEARs</span>
              </div>
            </div>
          </div>
          <div className={styles.productIntro}>
            <span className={styles.eyebrow}>ASÍ SE VE TENER TODO A MANO</span>
            <p>
              Una sola vista. <strong>Todo tu mundo financiero.</strong>
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
                  <LockKeyhole size={10} /> cuantai / tu espacio de trabajo
                </span>
                <span className={styles.demoBadge}>VISTA DEMO</span>
              </div>
              <div className={styles.livePreview}>
                <div className={styles.livePreviewHeading}>
                  <div>
                    <span className={styles.eyebrow}>EXPLORÁ EL MERCADO</span>
                    <h3>Tu próximo análisis empieza acá.</h3>
                    <p>
                      Probá el gráfico: cambiá el intervalo, acercá el precio o agregá indicadores.
                    </p>
                  </div>
                  <span className={styles.liveBadge}>GRÁFICO INTERACTIVO</span>
                </div>
                <TradingViewChart symbol="NASDAQ:NVDA" height={640} theme="dark" />
              </div>
            </motion.div>
            <div className={`${styles.floatingNote} ${styles.noteOne}`}>
              <span className={styles.noteIcon}>
                <Flame size={18} />
              </span>
              <div>
                El mercado, en movimiento.
                <small>Explorá el gráfico con tus propias herramientas.</small>
              </div>
              <Activity size={25} />
            </div>
            <div className={`${styles.floatingNote} ${styles.noteTwo}`}>
              <span className={styles.noteIcon}>
                <Sparkles size={18} />
              </span>
              <div>
                Consultá a tus agentes de IA.
                <small>Datos, orientación y análisis en un mismo espacio.</small>
              </div>
            </div>
          </div>
          <div className={styles.heroCaption}>
            <span>GRÁFICO INTERACTIVO · DATOS Y HERRAMIENTAS DE TRADINGVIEW</span>
            <a href="#funciones">
              Hay más por descubrir <ArrowDown size={13} />
            </a>
          </div>
        </section>

        <section className={styles.marketBand} aria-label="Mercados disponibles">
          <div className={styles.marketBandLabel}>
            <Globe2 size={15} /> GLOBAL POR NATURALEZA.
            <br />
            <span>LOCAL POR CONVICCIÓN.</span>
          </div>
          <div className={styles.marketMarquee}>
            <div className={styles.marketTrack}>
              {[false, true].map((copy) => (
                <div
                  className={styles.marketGroup}
                  key={String(copy)}
                  aria-hidden={copy || undefined}
                >
                  {markets.map(([symbol, name, logo]) => (
                    <div className={styles.marketChip} key={symbol}>
                      <Image src={`/asset-logos/${logo}`} alt="" width={30} height={30} />
                      <span>
                        {symbol}
                        <small>{name}</small>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.explorer} id="plataforma" aria-labelledby="platform-title">
          <SectionBackdrop />
          <Reveal className={styles.sectionHeading}>
            <span className={styles.eyebrow}>
              <span /> CONOCÉ TU PRÓXIMO WORKSPACE
            </span>
            <h2 id="platform-title">
              Menos ir de una app a otra.
              <br />
              <span>Más control de tus activos.</span>
            </h2>
            <p>
              Mirá la plataforma por dentro. Elegí una función y descubrí cómo te ayuda a seguir tus
              inversiones.
            </p>
          </Reveal>
          <div className={styles.tabList} role="tablist" aria-label="Funciones de Cuantai">
            {features.map((item, index) => {
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
                  {item.label}
                  {active === index && (
                    <motion.span
                      layoutId="active-feature"
                      className={styles.activeTab}
                      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
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
                {String(active + 1).padStart(2, '0')} / {String(features.length).padStart(2, '0')}
              </span>
              <span className={styles.featureIcon}>
                <FeatureIcon size={24} />
              </span>
              <span className={styles.eyebrow}>{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <ul>
                {feature.bullets.map((bullet) => (
                  <li key={bullet}>
                    <Check size={13} />
                    {bullet}
                  </li>
                ))}
              </ul>
              <Link href={feature.href}>
                Explorar {feature.label.toLowerCase()} <ArrowUpRight size={15} />
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
                    alt={`Captura real de ${feature.label} en Cuantai, con una cuenta de demostración`}
                  />
                </motion.div>
              </AnimatePresence>
              <span className={styles.imageLabel}>
                <span /> CAPTURA REAL · DEMOSTRACIÓN
              </span>
              <button
                type="button"
                className={styles.expandCapture}
                onClick={() => setExpandedImage({ name: feature.id, label: feature.label })}
              >
                Ampliar captura <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        </section>

        <section className={styles.functions} id="funciones" aria-labelledby="functions-title">
          <SectionBackdrop />
          <Reveal className={styles.splitHeading}>
            <div>
              <span className={styles.eyebrow}>
                <span /> TODO TIENE SU LUGAR
              </span>
              <h2 id="functions-title">
                Tu seguimiento, completo.
                <br />
                <span>Tu información, conectada.</span>
              </h2>
            </div>
            <p>
              Desde lo que ya tenés hasta tu próxima idea. Un lugar para mirar, investigar y seguir
              cada inversión.
            </p>
          </Reveal>
          <div className={styles.bento}>
            <Reveal className={`${styles.bentoCard} ${styles.chartCard}`}>
              <div className={styles.cardTop}>
                <CandlestickChart size={22} />
                <span>01 / EXPLORÁ</span>
              </div>
              <h3>El gráfico es el comienzo.</h3>
              <p>
                Herramientas de TradingView, indicadores, distintos intervalos y layouts para seguir
                más de un activo.
              </p>
              <div className={styles.cardScreenshot}>
                <ProductImage
                  name="charts-detail"
                  alt="Terminal de Cuantai con herramientas de gráficos de TradingView"
                />
              </div>
              <button
                type="button"
                className={styles.expandCapture}
                onClick={() => setExpandedImage({ name: 'charts-detail', label: 'Gráficos' })}
              >
                Ampliar captura <ArrowUpRight size={15} />
              </button>
              <Link href="/demo?view=charts" className={styles.cardLink}>
                Abrir la terminal <ArrowUpRight size={16} />
              </Link>
            </Reveal>
            <Reveal className={`${styles.bentoCard} ${styles.researchCard}`} delay={0.08}>
              <div className={styles.cardTop}>
                <Sparkles size={22} />
                <span>02 / ENTENDÉ</span>
              </div>
              <h3>Tu investigación, acompañada por IA.</h3>
              <p>
                Consultá, explorá datos y contrastá ideas con agentes de IA. Reuní análisis
                fundamental, técnico, riesgo y fuentes en la misma investigación.
              </p>
              <div className={styles.cardScreenshot}>
                <ProductImage
                  name="research-detail"
                  alt="Ficha de investigación de NVIDIA en Cuantai con rendimiento, riesgo y conversación por activo"
                />
              </div>
              <button
                type="button"
                className={styles.expandCapture}
                onClick={() =>
                  setExpandedImage({ name: 'research-detail', label: 'Investigación' })
                }
              >
                Ampliar captura <ArrowUpRight size={15} />
              </button>
              <Link href="/asset/NASDAQ/NVDA?demo=true" className={styles.cardLink}>
                Conocer la investigación <ArrowUpRight size={16} />
              </Link>
            </Reveal>
            <Reveal className={`${styles.bentoCard} ${styles.portfolioCard}`}>
              <div className={styles.portfolioCopy}>
                <div className={styles.cardTop}>
                  <Wallet size={22} />
                  <span>03 / CONECTÁ</span>
                </div>
                <h3>
                  Tu portfolio.
                  <br />
                  <span>La historia completa.</span>
                </h3>
                <p>
                  De cada movimiento a la visión del conjunto. Posiciones, composición, costos y
                  resultados, con cada moneda en su lugar.
                </p>
                <div className={styles.portfolioTags}>
                  <span>Posiciones</span>
                  <span>Movimientos</span>
                  <span>Composición</span>
                </div>
                <Link href="/demo?view=portfolio" className={styles.cardLink}>
                  Explorar el portfolio <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className={styles.portfolioScreenshot}>
                <ProductImage
                  name="portfolio-detail"
                  alt="Portfolio real de demostración con posiciones, costos, resultados y composición por activo"
                />
                <button
                  type="button"
                  className={styles.expandCapture}
                  onClick={() => setExpandedImage({ name: 'portfolio-detail', label: 'Portfolio' })}
                >
                  Ampliar captura <ArrowUpRight size={15} />
                </button>
              </div>
            </Reveal>
          </div>
          <div className={styles.detailGrid}>
            {[
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
                <h3>{title}</h3>
                <p>{text}</p>
                <Link href={href} aria-label={`Explorar ${title.toLowerCase()}`}>
                  <ArrowUpRight size={18} />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <section className={styles.workflow} id="como-funciona" aria-labelledby="workflow-title">
          <SectionBackdrop />
          <Reveal className={styles.sectionHeading}>
            <span className={styles.eyebrow}>
              <span /> DE LA CURIOSIDAD A TU WORKSPACE
            </span>
            <h2 id="workflow-title">
              Entrá con una pregunta.
              <br />
              <span>Salí con más perspectiva.</span>
            </h2>
          </Reveal>
          <div className={styles.steps}>
            {[
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
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal className={styles.finalCta}>
          <SectionBackdrop />
          <div className={styles.ctaOrbit} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span className={styles.eyebrow}>TU PRÓXIMA PERSPECTIVA EMPIEZA ACÁ</span>
          <h2>
            Tus activos, juntos.
            <br />
            <span>La IA, a tu lado.</span>
          </h2>
          <p>
            Un lugar para seguir tus inversiones y consultar a agentes de IA sobre datos, ideas y
            análisis.
          </p>
          <div className={styles.actions}>
            <Link href="/register" className={styles.primaryCta}>
              Crear mi espacio <ArrowUpRight size={18} />
            </Link>
            <Link href="/demo" className={styles.secondaryCta}>
              Primero, la demo <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </main>
      <Modal
        open={Boolean(expandedImage)}
        onOpenChange={(open) => {
          if (!open) setExpandedImage(null);
        }}
        title={expandedImage ? `${expandedImage.label} · captura ampliada` : 'Captura ampliada'}
        description="Panel real de una cuenta de demostración. Podés recorrer la imagen en su tamaño original."
        className={styles.captureModal}
      >
        {expandedImage && (
          <div className={styles.expandedCapture}>
            <ProductImage
              name={expandedImage.name}
              alt={`Vista ampliada de ${expandedImage.label}`}
            />
          </div>
        )}
      </Modal>
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div>
            <Brand />
            <p>Una nueva perspectiva de tus inversiones.</p>
          </div>
          <div>
            <a href="#plataforma">La plataforma</a>
            <Link href="/data-policy">
              Datos y transparencia <ArrowUpRight size={12} />
            </Link>
            <Link href="/login">Tu cuenta</Link>
          </div>
          <button
            className={styles.motionToggle}
            onClick={() => setAmbientPaused((value) => !value)}
            aria-label={
              ambientPaused ? 'Activar animaciones de fondo' : 'Pausar animaciones de fondo'
            }
          >
            {ambientPaused ? <Play size={13} /> : <Pause size={13} />} Animaciones{' '}
            {ambientPaused ? 'pausadas' : 'activadas'}
          </button>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Cuantai</span>
          <p>
            Capturas de una cuenta de demostración. Los precios de Cuantai en las capturas son
            sintéticos; los gráficos de TradingView usan su propia fuente. La cobertura de
            cotizaciones, noticias, estados financieros e IA depende de los proveedores
            configurados. Herramientas de investigación y seguimiento, sin ejecución de operaciones.
          </p>
        </div>
      </footer>
    </div>
  );
}
