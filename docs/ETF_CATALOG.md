# Catálogo de ETFs de Estados Unidos

La categoría ETFs usa los directorios públicos `nasdaqlisted.txt` y `otherlisted.txt` de Nasdaq Trader. Se incluyen únicamente filas con `ETF=Y` y `Test Issue=N`; se preservan nombre, ticker y bolsa principal. La clasificación sigue al editor del directorio y puede incluir estructuras de ETP distintas. No es un ranking de inversión ni una selección de recomendaciones.

Actualizar con `npm run data:sync-etfs`. El script valida encabezados, códigos de bolsa, símbolos y duplicados antes de reemplazar `src/lib/market/data/etfs.json`. Conserva las fechas de creación de ambos archivos y la fecha de recuperación. No importa precios, posiciones ni carteras de fondos.

Códigos: Nasdaq usa su propio archivo; el directorio de otras bolsas identifica N=NYSE, P=NYSE Arca, A=NYSE American, Z=Cboe/BATS, V=IEX y F=Texas Stock Exchange. El código F se verifica en el aviso técnico DTN2026-10 de Nasdaq. Una bolsa sin cobertura de precios o gráficos queda sin datos en ese proveedor, conservando su identidad.

Los tres ejemplos iniciales (SPY, QQQ y DIA) dejaron de limitar la categoría. Los identificadores antiguos de SPY y DIA se conservan para carteras/workspaces existentes, pero no se duplican en el catálogo visible. Las consultas resuelven su mercado principal actual. Los CEDEARs siguen siendo especies BYMA independientes en Cedears ARG.

El catálogo se pagina de a 50 instrumentos. La búsqueda recorre todos los ETFs y prioriza la coincidencia exacta de ticker. Al iniciar se muestra una selección de accesos conocidos y luego el resto alfabéticamente; este orden no representa rendimiento, tamaño ni una recomendación.

Los gráficos de NYSE Arca se abren con el identificador AMEX de TradingView. Los ETFs de Cboe usan BATS. Las cotizaciones conservan la validación de mercado y moneda del adaptador. Un ETF sin dato real no recibe el valor 100 ni otro precio de relleno en demo.

Los logos de los accesos iniciales se descargaron al proyecto. Se pueden actualizar imágenes puntuales con `node --import tsx scripts/sync-asset-logos.ts VOO,IVV,VTI,TLT,GLD`; el resto usa la fuente de imágenes disponible o el monograma de su ticker.

Fuentes: [Definiciones del directorio de Nasdaq Trader](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs), [código de mercado F](https://m.nasdaqtrader.com/TraderNews.aspx?id=DTN2026-10).
