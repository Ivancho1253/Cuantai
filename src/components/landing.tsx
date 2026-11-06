'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Globe2,
  Layers3,
  ChartNoAxesCombined,
  ShieldCheck,
  Command,
  LayoutDashboard,
  CandlestickChart,
  Wallet,
  Star,
  Newspaper,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Brand, DataBadge, AssetIcon } from './ui';
import { TradingViewChart } from './tradingview-chart';
import { instruments } from '@/lib/market/catalog';
import { demoHistory } from '@/lib/market/demo';
import { number } from '@/lib/utils';
const nvda = demoHistory(instruments[0]);
const btc = demoHistory(instruments.find((i) => i.symbol === 'BTCUSDT')!);
export function Landing() {
  const reduced = useReducedMotion();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Producto">
          <a href="#platform">Plataforma</a>
          <a href="#intelligence">Inteligencia</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#global">Mercados</a>
        </nav>
        <div>
          <Link className="landing-login" href="/login">
            Iniciar sesión
          </Link>
          <Link className="button button-primary small-button" href="/register">
            Empezar <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-grid-bg" />
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hero-copy"
          >
            <Link href="/demo" className="hero-announcement">
              <span className="connection-dot" /> Un nuevo punto de vista sobre tus inversiones{' '}
              <ArrowUpRight size={13} />
            </Link>
            <h1>
              Leé el mercado.
              <br />
              <span>Encontrá tu perspectiva.</span>
            </h1>
            <p>
              Gráficos profesionales, inteligencia artificial y tu portfolio.
              <br />
              Conectá toda la información. Dale claridad a tu próxima decisión.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="button button-primary">
                Get Started <ArrowRight size={16} />
              </Link>
              <Link href="/demo" className="button button-secondary">
                Explore Platform <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-caption">
              <span>Tu espacio. Tus mercados.</span>
              <i />
              <span>Una visión completa.</span>
            </div>
          </motion.div>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hero-product"
            id="platform"
          >
            <div className="preview-window-bar">
              <span className="window-dots">
                <i />
                <i />
                <i />
              </span>
              <span>
                <ShieldCheck size={11} /> cuantai / personal workspace
              </span>
              <span>
                PRODUCT PREVIEW <DataBadge status="demo" />
              </span>
            </div>
            <div className="preview-app">
              <aside className="preview-sidebar">
                <Brand />
                <div className="nav-label">WORKSPACE</div>
                {[
                  [LayoutDashboard, 'Overview'],
                  [Globe2, 'Markets'],
                  [CandlestickChart, 'Charts'],
                  [Sparkles, 'AI Analyst'],
                  [Wallet, 'Portfolio'],
                  [Star, 'Watchlists'],
                  [Newspaper, 'News'],
                ].map(([Icon, label]) => {
                  const I = Icon as typeof Globe2;
                  return (
                    <div key={String(label)} className={label === 'Charts' ? 'active' : ''}>
                      <I size={14} />
                      <span>{String(label)}</span>
                      {label === 'AI Analyst' && <small>AI</small>}
                    </div>
                  );
                })}
                <div className="preview-sidebar-foot">
                  <span className="user-avatar">C</span>
                  <span>
                    Tu workspace<small>Personal account</small>
                  </span>
                </div>
              </aside>
              <div className="preview-main">
                <div className="preview-topbar">
                  <span>
                    <Command size={11} /> Buscar activos, mercados...
                  </span>
                  <span>
                    Global markets <span className="connection-dot" /> Demo
                  </span>
                </div>
                <div className="preview-content">
                  <div className="preview-title">
                    <div>
                      <small>PROFESSIONAL CHARTING</small>
                      <h3>El contexto cambia todo.</h3>
                    </div>
                    <span className="preview-chip">
                      <Layers3 size={12} /> Mi perspectiva
                    </span>
                  </div>
                  <div className="preview-terminal">
                    <div className="preview-chart">
                      <div className="preview-chart-heading">
                        <AssetIcon instrument={nvda.instrument} small />
                        <span>
                          <strong>NVIDIA Corporation</strong>
                          <small>NVDA · NASDAQ · USD</small>
                        </span>
                        <span className="preview-price">TradingView</span>
                      </div>
                      <TradingViewChart symbol="NASDAQ:NVDA" height={330} />
                      <div className="preview-chart-foot">
                        Gráfico y datos provistos por TradingView
                      </div>
                    </div>
                    <aside className="preview-intelligence">
                      <div className="eyebrow">
                        <Sparkles size={12} /> CUANTAI INTELLIGENCE
                      </div>
                      <h4>
                        Más allá
                        <br />
                        del precio.
                      </h4>
                      <p>
                        Una tendencia es una pieza de la historia. La evidencia conecta el resto.
                      </p>
                      <div className="preview-trend">
                        <span>Lectura ilustrativa</span>
                        <strong>
                          <ChartNoAxesCombined size={13} /> Contexto técnico
                        </strong>
                      </div>
                      <div className="preview-check">
                        <Check size={11} /> Métricas determinísticas
                      </div>
                      <div className="preview-check">
                        <Check size={11} /> Fuentes e invalidaciones
                      </div>
                      <Link href="/demo?view=analyst">
                        Explorar un análisis <ArrowUpRight size={12} />
                      </Link>
                    </aside>
                  </div>
                  <div className="preview-bottom-cards">
                    {[nvda, btc, demoHistory(instruments[7])].map((d) => (
                      <div key={d.instrument.id}>
                        <AssetIcon instrument={d.instrument} small />
                        <span>
                          <strong>{d.instrument.symbol}</strong>
                          <small>{d.instrument.exchange}</small>
                        </span>
                        <small>DEMO</small>
                        <b>{number(d.quote?.price)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
        <div className="landing-market-strip">
          <span>UN WORKSPACE. MUCHAS PERSPECTIVAS.</span>
          <div>
            <span>NASDAQ</span>
            <span>NYSE</span>
            <span>CRYPTO</span>
            <span>BYMA</span>
            <small>Cobertura según proveedor y licencia</small>
          </div>
        </div>
        <section className="landing-editorial" id="intelligence">
          <div className="editorial-intro">
            <span className="eyebrow">
              <span className="tiny-line" /> BUILT FOR CLEARER THINKING
            </span>
            <h2>
              Toda la señal.
              <br />
              <em>Menos ruido.</em>
            </h2>
            <p>
              No te faltan datos. Te falta una forma de conectarlos.
              <br />
              Cuantai reúne las herramientas para ver el mercado con perspectiva.
            </p>
          </div>
          <div className="editorial-features">
            <Link href="/demo?view=markets">
              <span>01</span>
              <div>
                <h3>
                  El mercado, conectado.
                  <ArrowUpRight size={21} />
                </h3>
                <p>
                  Explorá acciones, ETFs y cripto. Descubrí especies locales sin perder de vista su
                  moneda ni su origen.
                </p>
                <small>MARKET INTELLIGENCE</small>
              </div>
            </Link>
            <Link href="/demo?view=charts">
              <span>02</span>
              <div>
                <h3>
                  Tu gráfico. Tus reglas.
                  <ArrowUpRight size={21} />
                </h3>
                <p>
                  Combiná medias móviles, RSI, MACD y más. Guardá tu perspectiva y volvé a ella
                  cuando la necesites.
                </p>
                <small>PROFESSIONAL CHARTS</small>
              </div>
            </Link>
            <Link href="/demo?view=analyst">
              <span>03</span>
              <div>
                <h3>
                  Preguntas que abren perspectivas.
                  <ArrowUpRight size={21} />
                </h3>
                <p>
                  Investigá la evidencia, contrastá escenarios y entendé qué podría invalidar una
                  hipótesis.
                </p>
                <small>AI-POWERED ANALYSIS</small>
              </div>
            </Link>
          </div>
        </section>
        <section className="landing-chart-feature">
          <div className="chart-feature-visual">
            <div className="feature-visual-label">
              <span className="connection-dot" /> BTC / USDT · TradingView
            </div>
            <TradingViewChart symbol="BINANCE:BTCUSDT" height={440} />
            <div className="floating-indicator">Herramientas de TradingView</div>
          </div>
          <div className="chart-feature-copy">
            <span className="eyebrow">UNA HERRAMIENTA PARA PENSAR</span>
            <h2>
              Más capas de análisis.
              <br />
              <em>Más claridad.</em>
            </h2>
            <p>
              Velas interactivas, indicadores simultáneos y workspaces que siguen tu forma de
              investigar. Todo en una experiencia ágil y precisa.
            </p>
            <div className="feature-check-list">
              <span>
                <Check size={14} /> Herramientas oficiales de TradingView
              </span>
              <span>
                <Check size={14} /> Layouts de uno, dos y cuatro gráficos
              </span>
              <span>
                <Check size={14} /> Configuración de apertura guardada en tu cuenta
              </span>
            </div>
            <Link className="text-link" href="/demo?view=charts">
              Entrar al terminal <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="landing-portfolio" id="portfolio">
          <div>
            <span className="eyebrow">PORTFOLIO INTELLIGENCE</span>
            <h2>
              Tus inversiones tienen
              <br />
              algo en común.
              <br />
              <em>A vos.</em>
            </h2>
            <p>
              Acciones en dólares. CEDEARs en pesos. Cripto en tu exchange.
              <br />
              Cada posición con su identidad. Tu patrimonio con una visión completa.
            </p>
            <Link className="button button-secondary" href="/demo?view=portfolio">
              Conocé tu portfolio <ArrowUpRight size={15} />
            </Link>
            <div className="portfolio-principles">
              <span>
                <ShieldCheck size={16} /> Decimales precisos
              </span>
              <span>
                <Globe2 size={16} /> Multimoneda
              </span>
              <span>
                <Layers3 size={16} /> Costo FIFO
              </span>
            </div>
          </div>
          <div className="landing-portfolio-visual">
            <span className="visual-demo-label">COMPOSICIÓN ILUSTRATIVA</span>
            <div className="portfolio-ring">
              <div>
                <small>UNA VISIÓN</small>
                <strong>
                  360<span>°</span>
                </strong>
                <small>DE TU PATRIMONIO</small>
              </div>
            </div>
            <div className="portfolio-float pf-one">
              <span style={{ background: '#c3e78a' }}>A</span>
              <div>
                Acciones & ETFs<small>Tu exposición global</small>
              </div>
              <ArrowUpRight size={15} />
            </div>
            <div className="portfolio-float pf-two">
              <span style={{ background: '#b09ae5' }}>AR</span>
              <div>
                Argentina & CEDEARs<small>Cada especie, su moneda</small>
              </div>
              <ArrowUpRight size={15} />
            </div>
            <div className="portfolio-float pf-three">
              <span style={{ background: '#e3b06a' }}>₿</span>
              <div>
                Criptomonedas<small>Sin equiparar USDT a USD</small>
              </div>
              <ArrowUpRight size={15} />
            </div>
          </div>
        </section>
        <section className="global-feature" id="global">
          <div className="global-coordinate">
            34°36′ S &nbsp; 58°22′ W &nbsp; → &nbsp; THE WORLD
          </div>
          <Globe2 size={38} strokeWidth={1} />
          <h2>
            Perspectiva global.
            <br />
            <em>Entendimiento local.</em>
          </h2>
          <p>
            Diseñado para inversores que cruzan mercados.
            <br />
            Con Argentina y los CEDEARs como parte del núcleo.
          </p>
          <div className="global-tags">
            <span>US Stocks</span>
            <span>ETFs</span>
            <span>Cryptocurrency</span>
            <span>CEDEARs</span>
            <span>BYMA</span>
          </div>
          <Link href="/data-policy">
            Datos con procedencia. Límites transparentes. <ArrowUpRight size={14} />
          </Link>
        </section>
        <section className="landing-final-cta">
          <span className="eyebrow">TU PRÓXIMA PERSPECTIVA EMPIEZA ACÁ</span>
          <h2>
            El mercado no se detiene.
            <br />
            <em>Tu claridad empieza hoy.</em>
          </h2>
          <div className="hero-actions">
            <Link href="/register" className="button button-primary">
              Crear mi espacio <ArrowRight size={16} />
            </Link>
            <Link href="/demo" className="button button-secondary">
              Explorar primero <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Brand />
          <p>Inteligencia para ver más allá.</p>
        </div>
        <div>
          <Link href="/data-policy">
            Datos y metodología <ArrowUpRight size={12} />
          </Link>
          <Link href="/login">
            Tu cuenta <ChevronRight size={12} />
          </Link>
          <span>© {new Date().getFullYear()} Cuantai</span>
        </div>
        <p className="footer-disclaimer">
          Herramientas de investigación y seguimiento. Sin ejecución de operaciones. Las vistas demo
          contienen datos sintéticos.
        </p>
      </footer>
    </div>
  );
}
