# Idiomas, noticias e importación de cartera

La interfaz ofrece español (predeterminado), inglés y portugués en la cabecera de la landing y del dashboard. La elección se guarda en la cookie `cuantai_lang`; con sesión se sincroniza mediante PATCH de preferencias, sin reemplazar las demás opciones. Los diccionarios están en `src/lib/i18n/{en,pt}.json`. Los nombres de activos, contenido publicado por terceros y textos de informes ya generados conservan su idioma original. El widget TradingView recibe el idioma seleccionado.

Las tarjetas de noticias abren un lector dentro de Cuantai. Se muestra la imagen publicada en RSS o una ilustración local si falta o no carga, junto con el texto distribuido por el medio. El enlace a la publicación original queda al final. No se eluden muros de pago ni se presentan extractos como artículos completos.

## Importar una cartera

Abrir **Portafolio → Importar cartera** y elegir un archivo, una foto o una wallet. Seleccionar la cartera de destino, el formato de números/fechas y si el contenido representa movimientos o saldos. Revisar y corregir filas antes de confirmar. La vista previa no registra operaciones; la confirmación es atómica, idempotente y vuelve a validar saldo, propiedad de la cartera y cambios concurrentes. Vence a los 30 minutos.

- **Excel/CSV:** XLSX, CSV o TSV, hasta 10 MB y 500 filas por lote. Incluye selección de hoja y asociación de columnas. Encabezados en español, inglés y portugués. No ejecuta macros o fórmulas. Se usan resultados almacenados por el exportador cuando están disponibles.
- **Comprobantes/capturas:** PNG, JPG o WebP. Tesseract reconoce texto en el navegador (es/en/pt), sin subir la imagen ni requerir una clave de IA. La primera lectura descarga el motor y los modelos OCR desde sus distribuidores. Capturas con tablas complejas pueden requerir corregir el texto o seleccionar el activo; no se garantiza interpretación de cualquier diseño de broker. Una operación sin tipo, precio o fecha queda pendiente de corrección.
- **Movimientos:** ticker o instrumento exacto, cantidad, precio unitario, fecha, operación y moneda. Comisiones, broker, referencia y FX son opcionales. No se decide entre especies ambiguas. Operaciones equivalentes se excluyen; una referencia de orden distinta permite distinguir operaciones legítimas iguales.
- **Saldos:** una captura representa cantidades a una fecha. Se registran ajustes de entrada/salida, no compras ficticias. Sin costo de adquisición, el costo y la ganancia quedan desconocidos. Los activos no incluidos en un archivo manual no se eliminan.
- **Wallets:** solo dirección pública, sin conexión, firma o clave privada. Ethereum usa Blockscout y Solana RPC público. `BLOCKSCOUT_API_KEY` habilita Base, Arbitrum, Optimism y Polygon; `SOLANA_RPC_URL` permite usar un RPC dedicado. Un fallo de saldos no prepara una captura incompleta como si fuera completa.

Las wallets importan saldos nativos y tokens fungibles por contrato/mint; no importan NFTs ni posiciones de protocolos DeFi. Dos wallets aportan sus saldos por separado. Las nuevas lecturas generan diferencias respecto de la última lectura confirmada de esa dirección. Una captura completa puede retirar saldos que desaparecieron de esa misma wallet; exige revisar los ajustes y no afecta otras direcciones. Si se agregan manualmente operaciones de esa wallet entre capturas, se debe conciliar antes de volver a importar para evitar contar dos veces el mismo movimiento.

La actividad de wallets es una consulta reciente, parcial y de solo lectura. EVM combina transferencias de tokens y operaciones externas; no incluye todas las trazas internas. Solana pagina firmas e interpreta variaciones de saldo de hasta cinco operaciones por página, sujeto al RPC. Entradas y salidas simultáneas se identifican como **posible intercambio**, sin afirmar compras/ventas ni inventar precios o costos históricos. Para un registro FIFO completo se necesita el export de operaciones del broker/exchange o un indexador con cobertura histórica. No hay sincronización automática en segundo plano.

El registro de contratos proviene de CoinGecko y solo asigna precios a coincidencias exactas verificadas del catálogo. Tokens sin correspondencia conservan su identidad y aparecen sin cotización; nunca reciben un precio sintético por tener el mismo símbolo que otro activo.

## Operación y validación

Ejecutar `npm run db:migrate` antes de desplegar (migraciones 0004 y 0005). El modo local aplica las migraciones al iniciar la conexión. Los archivos se procesan en el navegador; el servidor recibe filas estructuradas, limita el tamaño y autoriza cada importación. Los borradores se guardan de forma privada en `portfolio_imports`; los movimientos conservan una clave de importación para evitar duplicados.

Pruebas: `tests/unit/portfolio-import.test.ts`, `wallet-import.test.ts`, `rss-news.test.ts` y `tests/e2e/import-and-languages.spec.ts`, además de los recorridos previos de la plataforma. El OCR de extremo a extremo utiliza un comprobante PNG real generado para la prueba. Los proveedores se prueban con respuestas controladas para cubrir errores sin depender de sus límites públicos.

Referencias: [Tesseract.js](https://github.com/naptha/tesseract.js), [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction), [Blockscout API](https://docs.blockscout.com/devs/apis).

Las fotos se toman primero del RSS, incluidos grupos de medios anidados. Si falta una foto, se busca Open Graph/Twitter Image en las páginas de CNBC, MarketWatch y Yahoo mediante hosts permitidos y redirecciones validadas. La lectura de metadatos tiene límite de tamaño, tiempo y concurrencia, y se almacena en caché. Si no existe una imagen accesible, la tarjeta muestra un respaldo compacto con el editor; no una gráfica de mercado ficticia. Los extractos conservan la lectura interna y el enlace original al final.
