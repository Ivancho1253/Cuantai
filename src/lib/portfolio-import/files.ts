import { receiptRows } from './text-parser';
export type FileSheet = { name: string; rows: Record<string, string>[] };
export async function readPortfolioFile(
  file: File,
  mode: 'trades' | 'holdings',
  onProgress: (message: string) => void,
  signal?: AbortSignal,
): Promise<{ sheets: FileSheet[]; text?: string; confidence?: number }> {
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB');
  signal?.throwIfAborted();
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (extension === 'xlsx') {
    onProgress('Leyendo el Excel…');
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheets: FileSheet[] = [];
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount > 10000)
        throw new Error(
          'La hoja supera diez mil filas. Exportá solo los movimientos que querés importar.',
        );
      const matrix: string[][] = [];
      sheet.eachRow((row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, index) => {
          const value = cell.value;
          cells[index - 1] =
            value instanceof Date ? value.toISOString().slice(0, 10) : cell.text.slice(0, 2000);
        });
        matrix.push(cells);
      });
      if (matrix.length) sheets.push({ name: sheet.name, rows: matrixRows(matrix) });
    }
    if (!sheets.length) throw new Error('El Excel no contiene filas legibles');
    return { sheets };
  }
  if (extension === 'csv' || extension === 'tsv') {
    onProgress('Leyendo el archivo…');
    const text = await file.text();
    const first = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
    const delimiter =
      extension === 'tsv' ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
    const { parse } = await import('csv-parse/browser/esm/sync');
    const matrix = parse(text, {
      delimiter,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      max_record_size: 64000,
    }) as string[][];
    return { sheets: [{ name: file.name, rows: matrixRows(matrix) }] };
  }
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')) {
    onProgress('Preparando lectura de la imagen…');
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 30000000) {
      bitmap.close();
      throw new Error('La imagen es demasiado grande. Recortá el comprobante.');
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(2, 2400 / bitmap.width);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(['spa', 'eng', 'por'], 1, {
      logger: (message) => {
        if (message.status === 'recognizing text')
          onProgress(`Leyendo imagen: ${Math.round(message.progress * 100)}%`);
      },
    });
    const abort = () => {
      void worker.terminate();
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      signal?.throwIfAborted();
      const result = await worker.recognize(canvas);
      return {
        sheets: [{ name: file.name, rows: receiptRows(result.data.text, mode) }],
        text: result.data.text,
        confidence: result.data.confidence,
      };
    } finally {
      signal?.removeEventListener('abort', abort);
      await worker.terminate();
    }
  }
  throw new Error('Usá un archivo XLSX, CSV, TSV o una imagen PNG, JPG o WebP');
}
function matrixRows(matrix: string[][]) {
  const first = matrix.findIndex((row) =>
    row.some((cell) =>
      /^(ticker|symbol|activo|especie|cantidad|quantity|quantidade|asset)$/i.test(cell.trim()),
    ),
  );
  const index = first >= 0 ? first : 0;
  const headers = matrix[index]?.map((name, i) => name.trim() || `Columna ${i + 1}`) ?? [];
  const rows = matrix
    .slice(index + 1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(headers.map((name, i) => [name, row[i]?.trim() ?? ''])));
  if (rows.length > 500)
    throw new Error(
      'Podés revisar hasta 500 filas por importación. Dividí el archivo en varios lotes.',
    );
  if (!rows.length) throw new Error('No encontramos filas de datos debajo de los encabezados');
  return rows;
}
