import { expect, mockChatCompletions, openFixture, seedConsent, test } from './helpers';

test.describe('outlook fixture', () => {
  test('detects attachment cards in the outlook-style DOM', async ({ context, extensionId }) => {
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/outlook.html');
    const buttons = page.locator('.mbx-button', { hasText: 'Summarise' });
    await expect(buttons).toHaveCount(2, { timeout: 15_000 });
  });

  test('renders a summary for a DOCX attachment', async ({ context, extensionId }) => {
    await mockChatCompletions(context);
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/outlook.html');

    const docxCard = page.locator('[role="listitem"]', { hasText: 'contract.docx' });
    await docxCard.locator('.mbx-button', { hasText: 'Summarise' }).click();

    const summaryCard = page.locator('.mbx-card', { hasText: 'Summary' });
    await expect(summaryCard).toBeVisible({ timeout: 30_000 });
    await expect(summaryCard).toContainText('Q3 revenue grew 12 percent');
  });

  test('renders a summary for a TXT attachment', async ({ context, extensionId }) => {
    await mockChatCompletions(context);
    await seedConsent(context, extensionId);
    const page = await openFixture(context, '/outlook.html');

    const txtCard = page.locator('[role="listitem"]', { hasText: 'notes.txt' });
    await txtCard.locator('.mbx-button', { hasText: 'Summarise' }).click();

    const summaryCard = page.locator('.mbx-card', { hasText: 'Summary' });
    await expect(summaryCard).toBeVisible({ timeout: 30_000 });
    await expect(summaryCard).toContainText('Q3 revenue grew 12 percent');
  });
});
