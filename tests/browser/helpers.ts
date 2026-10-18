import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '../../src/shared/constants';
import type { MailBriefSettings } from '../../src/shared/types';

export const MOCK_ENDPOINT = 'http://127.0.0.1:5199';

export const SUMMARY_PAYLOAD = {
  executiveSummary: 'Q3 revenue grew 12 percent to 4.2 million with an 18 percent operating margin.',
  keyPoints: ['Churn fell to 3 percent after the September launch.', 'Renewal draft is with Legal.'],
  actionItems: [{ text: 'Priya to send the renewal draft to Legal', owner: 'Priya', deadline: 'Friday' }],
  decisions: ['Approved a Q4 pilot budget of 40k.'],
  risks: ['Supplier clause allows 30 day payment terms.'],
  unansweredQuestions: ['Whether the Berlin team can onboard by November.'],
};

interface MockOptions {
  delayMs?: number;
  failStatus?: number;
}

export async function mockChatCompletions(context: BrowserContext, options: MockOptions = {}): Promise<void> {
  await context.route('**/v1/chat/completions**', async (route) => {
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    const body = JSON.parse(route.request().postData() ?? '{}') as { messages?: Array<{ content?: string }> };
    const joined = (body.messages ?? []).map((m) => m.content ?? '').join('\n');

    if (options.failStatus) {
      await route.fulfill({
        status: options.failStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: `mock ${options.failStatus}` } }),
      });
      return;
    }

    if (joined.includes('connectivity probe')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: 'OK' } }] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(SUMMARY_PAYLOAD) } }] }),
    });
  });
}

export async function seedSettings(
  context: BrowserContext,
  extensionId: string,
  overrides: Partial<MailBriefSettings> = {}
): Promise<void> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const value = { ...DEFAULT_SETTINGS, ...overrides };
  await page.evaluate(async (args: { key: string; value: MailBriefSettings }) => {
    await chrome.storage.local.set({ [args.key]: args.value });
  }, { key: STORAGE_KEY, value });
  await page.close();
}

export async function seedConsent(context: BrowserContext, extensionId: string): Promise<void> {
  await seedSettings(context, extensionId, {
    baseUrl: `${MOCK_ENDPOINT}/v1`,
    apiKey: 'test-key-not-real',
    model: 'mock-model',
    consentGiven: true,
    consentEndpoint: `${MOCK_ENDPOINT}/v1`,
  });
}

export async function loadSettings(context: BrowserContext, extensionId: string): Promise<MailBriefSettings> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const value = await page.evaluate(async (key) => {
    const all = await chrome.storage.local.get(key);
    return all[key] ?? null;
  }, STORAGE_KEY);
  await page.close();
  return value as MailBriefSettings;
}

export async function openFixture(context: BrowserContext, path: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${MOCK_ENDPOINT}${path}`);
  return page;
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const existing = context.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://'));
  if (existing) return new URL(existing.url()).host;
  const worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
  return new URL(worker.url()).host;
}

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const dist = join(process.cwd(), 'dist');
    const userDataDir = await mkdtemp(join(tmpdir(), 'mailbrief-pw-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${dist}`,
        `--load-extension=${dist}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },
  extensionId: async ({ context }, use) => {
    await use(await getExtensionId(context));
  },
});

export { expect };
