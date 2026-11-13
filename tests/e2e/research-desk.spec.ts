import { test, expect } from '@playwright/test';

test('research answers a report question and offers a separate technical conversation', async ({
  page,
}) => {
  await page.goto('/demo?view=analyst');
  await page.getByLabel('Enfoque del informe').fill('¿Qué riesgo tiene?');
  await page.getByRole('button', { name: 'Generar informe' }).click();
  const report = page.locator('.research-document');
  await expect(report).toBeVisible();
  await expect(report.locator('.research-question-answer')).toContainText('¿Qué riesgo tiene?');
  await expect(report.locator('.chat-facts')).toContainText('Volatilidad');
  await expect(report).toContainText('Señal por señal');
  await page.getByRole('tab', { name: 'Preguntas y respuestas' }).click();
  await page.getByLabel('Pregunta sobre el activo', { exact: true }).fill('¿Qué dice el momentum?');
  await page.getByRole('button', { name: 'Enviar pregunta', exact: true }).click();
  await expect(page.locator('.asset-chat-answer')).toContainText('RSI');
  await expect(page.locator('.asset-chat-answer')).toContainText('Reglas');
});

test('research asset picker searches the catalog without opening a native select', async ({
  page,
}) => {
  await page.goto('/demo?view=analyst');
  await page.getByRole('button', { name: 'Activo para analizar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Elegir activo' });
  await dialog.getByLabel('Buscar activo para analizar').fill('AAPL');
  await dialog
    .getByRole('button')
    .filter({ hasText: 'AAPL' })
    .filter({ hasText: 'NASDAQ' })
    .first()
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Activo para analizar' })).toContainText('AAPL');
  await expect(page.locator('.research-desk select')).toHaveCount(0);
  await page.getByRole('button', { name: 'Generar informe' }).click();
  await expect(page.locator('.research-document-header h2')).toHaveText('Apple Inc.');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('news displays publisher links, filters headlines, and can refresh', async ({ page }) => {
  let loads = 0;
  await page.route('**/api/data/news?*', (route) => {
    loads++;
    return route.fulfill({
      json: {
        items: [
          {
            id: 'one',
            title: 'Reporte de resultados de Apple',
            source: 'Publicación original',
            url: 'https://publisher.test/apple',
            publishedAt: '2026-11-12T12:00:00Z',
            category: 'Mercados',
            summary:
              'Apple presenta sus resultados trimestrales con detalles de ingresos y servicios.',
            imageUrl: 'https://publisher.test/apple.jpg',
          },
        ],
      },
    });
  });
  await page.goto('/demo?view=news');
  const card = page.getByRole('button', { name: /Reporte de resultados/ });
  await expect(card).toBeVisible();
  await card.click();
  const reader = page.getByRole('dialog', { name: 'Reporte de resultados de Apple' });
  await expect(reader).toContainText('Apple presenta sus resultados trimestrales');
  await expect(
    reader.getByRole('link', { name: /Consultar la publicación original/ }),
  ).toHaveAttribute('href', 'https://publisher.test/apple');
  await reader.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByLabel('Buscar noticias').fill('no match');
  await expect(card).toHaveCount(0);
  await expect(page.getByText('No hay titulares que coincidan con tu búsqueda.')).toBeVisible();
  await page.getByLabel('Buscar noticias').clear();
  await page.getByRole('button', { name: 'Actualizar noticias' }).click();
  await expect.poll(() => loads).toBeGreaterThan(1);
});

test('signed-in research saves the answer and conversation without an AI key', async ({
  page,
  request,
}) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
  const signup = await request.post('/api/auth/sign-up/email', {
    headers: { Origin: baseURL },
    data: {
      name: 'Research QA',
      email: `research-${crypto.randomUUID()}@example.test`,
      password: 'Research-test-129!',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/analyst');
  await page.getByLabel('Enfoque del informe').fill('¿Dónde están los riesgos?');
  await page.getByRole('button', { name: 'Generar informe' }).click();
  await expect(page.locator('.research-question-answer')).toContainText('riesgos');
  await page.getByRole('tab', { name: 'Preguntas y respuestas' }).click();
  await page.getByLabel('Pregunta sobre el activo', { exact: true }).fill('Explicá la tendencia');
  await page.getByRole('button', { name: 'Enviar pregunta', exact: true }).click();
  await expect(page.locator('.asset-chat-answer')).toContainText('Reglas');
  await page.reload();
  await page.getByRole('tab', { name: 'Preguntas y respuestas' }).click();
  await expect(page.locator('.asset-chat-question')).toContainText('Explicá la tendencia');
});
