import { expect, mockChatCompletions, seedSettings, test } from './helpers';

test.describe('options page', () => {
  test('validates the base URL and reports save failures', async ({ context, extensionId }) => {
    await seedSettings(context, extensionId, {});
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('#baseUrl').fill('http://insecure.example.com/v1');
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.banner.error')).toContainText('HTTPS is required');
  });

  test('saves a valid configuration', async ({ context, extensionId }) => {
    await seedSettings(context, extensionId, {});
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('#baseUrl').fill('https://api.example.com/v1');
    await page.locator('#apiKey').fill('sk-test-not-real');
    await page.locator('#model').fill('gpt-4o-mini');
    await page.locator('button', { hasText: 'Save' }).click();

    await expect(page.locator('.banner.ok', { hasText: 'Settings saved.' })).toBeVisible();
  });

  test('tests the connection through the background service worker', async ({ context, extensionId }) => {
    await mockChatCompletions(context);
    await seedSettings(context, extensionId, {
      baseUrl: 'http://127.0.0.1:5199/v1',
      apiKey: 'test-key-not-real',
      model: 'mock-model',
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('button', { hasText: 'Test connection' }).click();
    await expect(page.locator('.banner.ok', { hasText: 'Connection succeeded' })).toBeVisible({ timeout: 30_000 });
  });

  test('reports endpoint auth failures on test connection', async ({ context, extensionId }) => {
    await mockChatCompletions(context, { failStatus: 401 });
    await seedSettings(context, extensionId, {
      baseUrl: 'http://127.0.0.1:5199/v1',
      apiKey: 'test-key-not-real',
      model: 'mock-model',
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('button', { hasText: 'Test connection' }).click();
    await expect(page.locator('.banner.error', { hasText: 'Authentication failed' })).toBeVisible({ timeout: 30_000 });
  });

  test('resets settings to defaults', async ({ context, extensionId }) => {
    await seedSettings(context, extensionId, { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test-not-real' });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('button', { hasText: 'Reset to defaults' }).click();
    await expect(page.locator('.banner.ok', { hasText: 'Settings reset' })).toBeVisible();
    await expect(page.locator('#apiKey')).toHaveValue('');
  });
});
