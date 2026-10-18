import { MOCK_ENDPOINT, expect, loadSettings, mockChatCompletions, openFixture, seedConsent, seedSettings, test } from './helpers';

test.describe('gmail fixture', () => {
  test('injects Summarise buttons next to detected attachments', async ({ context, extensionId }) => {
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/gmail.html');
    const buttons = page.locator('.mbx-button', { hasText: 'Summarise' });
    await expect(buttons).toHaveCount(4, { timeout: 15_000 });
  });

  test('renders a summary card end-to-end with consent already given', async ({ context, extensionId }) => {
    await mockChatCompletions(context);
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/gmail.html');

    const firstButton = page.locator('.mbx-button', { hasText: 'Summarise' }).first();
    await expect(firstButton).toBeVisible({ timeout: 15_000 });
    await firstButton.click();

    const summaryCard = page.locator('.mbx-card', { hasText: 'Summary' }).first();
    await expect(summaryCard).toBeVisible({ timeout: 30_000 });
    await expect(summaryCard).toContainText('Q3 revenue grew 12 percent');
    await expect(summaryCard).toContainText('Priya to send the renewal draft');
    await expect(summaryCard).toContainText('q3-report.pdf');
  });

  test('asks for explicit consent and shows the destination endpoint before the first request', async ({
    context,
    extensionId,
  }) => {
    await mockChatCompletions(context);
    await seedSettings(context, extensionId, {
      baseUrl: `${MOCK_ENDPOINT}/v1`,
      apiKey: 'test-key-not-real',
      model: 'mock-model',
      consentGiven: false,
      consentEndpoint: '',
    });
    const page = await openFixture(context, '/gmail.html');

    const firstButton = page.locator('.mbx-button', { hasText: 'Summarise' }).first();
    await firstButton.click();

    const consentCard = page.locator('.mbx-card[role="dialog"]');
    await expect(consentCard).toBeVisible();
    await expect(consentCard.locator('.mbx-consent-endpoint')).toContainText('127.0.0.1:5199');

    const continueButton = consentCard.locator('button', { hasText: 'Continue' });
    await expect(continueButton).toBeDisabled();
    await consentCard.locator('input[type="checkbox"]').check();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    const summaryCard = page.locator('.mbx-card', { hasText: 'Summary' }).first();
    await expect(summaryCard).toBeVisible({ timeout: 30_000 });

    const stored = await loadSettings(context, extensionId);
    expect(stored.consentGiven).toBe(true);
    expect(stored.consentEndpoint).toContain('127.0.0.1:5199');
  });

  test('shows an actionable OCR-required error for scanned PDFs', async ({ context, extensionId }) => {
    await mockChatCompletions(context);
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/gmail.html');

    const scannedCard = page.locator('[role="listitem"]', { hasText: 'scanned.pdf' });
    await scannedCard.locator('.mbx-button', { hasText: 'Summarise' }).click();

    const errorCard = scannedCard.locator('.mbx-card', { hasText: 'ocr-required' });
    await expect(errorCard).toBeVisible({ timeout: 30_000 });
    await expect(errorCard).toContainText('OCR');
  });

  test('shows a missing-url error when no download link exists', async ({ context, extensionId }) => {
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/gmail.html');

    const noLinkCard = page.locator('[role="listitem"]', { hasText: 'no-link.pdf' });
    await noLinkCard.locator('.mbx-button', { hasText: 'Summarise' }).click();

    const errorCard = noLinkCard.locator('.mbx-card', { hasText: 'missing-url' });
    await expect(errorCard).toBeVisible({ timeout: 15_000 });
  });

  test('blocks oversized files with a too-large error', async ({ context, extensionId }) => {
    await seedSettings(context, extensionId, {
      consentGiven: true,
      consentEndpoint: `${'http://127.0.0.1:5199'}/v1`,
      baseUrl: 'http://127.0.0.1:5199/v1',
      apiKey: 'test-key-not-real',
      model: 'mock-model',
      maxFileBytes: 10 * 1024,
    });
    const page = await openFixture(context, '/gmail.html');

    const firstCard = page.locator('[role="listitem"]', { hasText: 'large.txt' });
    await firstCard.locator('.mbx-button', { hasText: 'Summarise' }).click();

    const errorCard = firstCard.locator('.mbx-card', { hasText: 'too-large' });
    await expect(errorCard).toBeVisible({ timeout: 15_000 });
  });

  test('maps endpoint auth failures to an actionable error', async ({ context, extensionId }) => {
    await mockChatCompletions(context, { failStatus: 401 });
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/gmail.html');

    const firstCard = page.locator('[role="listitem"]', { hasText: 'q3-report.pdf' });
    await firstCard.locator('.mbx-button', { hasText: 'Summarise' }).click();

    const errorCard = firstCard.locator('.mbx-card', { hasText: 'auth' });
    await expect(errorCard).toBeVisible({ timeout: 30_000 });
    await expect(errorCard).toContainText('API key');
  });

  test('times out and offers a retryable error state', async ({ context, extensionId }) => {
    await mockChatCompletions(context, { delayMs: 6000 });
    await seedSettings(context, extensionId, {
      consentGiven: true,
      consentEndpoint: 'http://127.0.0.1:5199/v1',
      baseUrl: 'http://127.0.0.1:5199/v1',
      apiKey: 'test-key-not-real',
      model: 'mock-model',
      timeoutMs: 2000,
    });
    const page = await openFixture(context, '/gmail.html');

    const firstCard = page.locator('[role="listitem"]', { hasText: 'q3-report.pdf' });
    await firstCard.locator('.mbx-button', { hasText: 'Summarise' }).click();

    const errorCard = firstCard.locator('.mbx-card', { hasText: 'timeout' });
    await expect(errorCard).toBeVisible({ timeout: 20_000 });
    const retry = errorCard.locator('button', { hasText: 'Try again' });
    await expect(retry).toBeEnabled();
  });
});
