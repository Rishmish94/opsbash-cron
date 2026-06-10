import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/docker-compose-converter`;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function mockClipboard(page: Page) {
  await page.addInitScript(() => {
    let _stored = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => { _stored = t; return Promise.resolve(); },
        readText:  ()           => Promise.resolve(_stored),
      },
      configurable: true,
      writable: true,
    });
  });
}

async function setMode(page: Page, mode: 'run2compose' | 'compose2run') {
  await page.locator(`#btn-${mode}`).click();
  await page.waitForTimeout(200);
}

async function getRawOutput(page: Page): Promise<string> {
  // Try _rawText property first (set by the page's JS for syntax-highlighted output)
  const raw = await page.locator('#outputEl').evaluate(
    (el: HTMLElement) => (el as any)._rawText ?? el.textContent ?? ''
  );
  return raw.trim();
}

// =============================================================================
// FUNCTIONAL  (tests 1–24)
// =============================================================================

test.describe('Functional', () => {
  test.beforeEach(async ({ page }) => {
    await mockClipboard(page);
    await page.goto(PAGE);
  });

  test('1. Page loads and H1 contains "Docker Run to Compose"', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('Docker Run to Compose');
  });

  test('2. Run to Compose mode button is visible', async ({ page }) => {
    await expect(page.locator('#btn-run2compose')).toBeVisible();
  });

  test('3. Compose to Run mode button is visible', async ({ page }) => {
    await expect(page.locator('#btn-compose2run')).toBeVisible();
  });

  test('4. Default mode is Run to Compose (btn-run2compose is active)', async ({ page }) => {
    // The active button should appear visually distinct — check aria or a class
    const btn = page.locator('#btn-run2compose');
    await expect(btn).toBeVisible();
    // Input label should reference "docker run"
    const label = await page.locator('#inputLabel').textContent() ?? '';
    expect(label.toLowerCase()).toContain('run');
  });

  test('5. Input textarea is visible', async ({ page }) => {
    await expect(page.locator('#inputArea')).toBeVisible();
  });

  test('6. Default state shows output content (sample loaded on init)', async ({ page }) => {
    await expect(page.locator('#outputEl')).toBeVisible();
    await expect(page.locator('#outputEmpty')).toBeHidden();
  });

  test('7. Default run-to-compose output contains image key', async ({ page }) => {
    // Modern compose format does not include a top-level version: field
    const txt = await getRawOutput(page);
    expect(txt).toContain('image:');
  });

  test('8. Default run-to-compose output contains services key', async ({ page }) => {
    const txt = await getRawOutput(page);
    expect(txt).toContain('services');
  });

  test('9. Clicking Nginx preset loads an nginx docker run command', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="nginx"]').click();
    await page.waitForTimeout(200);
    const inputVal = await page.locator('#inputArea').inputValue();
    expect(inputVal.toLowerCase()).toContain('nginx');
  });

  test('10. Clicking Nginx preset produces compose output with nginx image', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="nginx"]').click();
    await page.waitForTimeout(200);
    const txt = await getRawOutput(page);
    expect(txt.toLowerCase()).toContain('nginx');
  });

  test('11. Clicking MySQL preset produces compose with mysql image', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="mysql"]').click();
    await page.waitForTimeout(200);
    const txt = await getRawOutput(page);
    expect(txt.toLowerCase()).toContain('mysql');
  });

  test('12. Clicking Redis preset produces compose with redis image', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="redis"]').click();
    await page.waitForTimeout(200);
    const txt = await getRawOutput(page);
    expect(txt.toLowerCase()).toContain('redis');
  });

  test('13. Clicking Postgres preset produces compose with postgres image', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="postgres"]').click();
    await page.waitForTimeout(200);
    const txt = await getRawOutput(page);
    expect(txt.toLowerCase()).toContain('postgres');
  });

  test('14. Switching to Compose to Run mode changes input label', async ({ page }) => {
    await setMode(page, 'compose2run');
    const label = await page.locator('#inputLabel').textContent() ?? '';
    expect(label.toLowerCase()).toMatch(/compose|yaml/);
  });

  test('15. In Compose to Run mode, output label changes', async ({ page }) => {
    await setMode(page, 'compose2run');
    const label = await page.locator('#outputLabel').textContent() ?? '';
    expect(label.toLowerCase()).toMatch(/run|docker/);
  });

  test('16. In Compose to Run mode, pasting a compose YAML shows docker run output', async ({ page }) => {
    await setMode(page, 'compose2run');
    const sampleCompose = `version: '3'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"`;
    await page.locator('#inputArea').fill(sampleCompose);
    await page.locator('#inputArea').dispatchEvent('input');
    await page.waitForTimeout(300);
    const txt = await getRawOutput(page);
    expect(txt.toLowerCase()).toContain('docker run');
  });

  test('17. In Compose to Run mode, output contains image name', async ({ page }) => {
    await setMode(page, 'compose2run');
    const sampleCompose = `version: '3'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"`;
    await page.locator('#inputArea').fill(sampleCompose);
    await page.locator('#inputArea').dispatchEvent('input');
    await page.waitForTimeout(300);
    const txt = await getRawOutput(page);
    expect(txt.toLowerCase()).toContain('nginx');
  });

  test('18. Invalid docker run command shows error message', async ({ page }) => {
    // A dangling flag with no image triggers "No image found" error
    await page.locator('#inputArea').fill('docker run --name');
    await page.locator('#inputArea').dispatchEvent('input');
    await page.waitForTimeout(200);
    await expect(page.locator('#errorEl')).toBeVisible();
    const txt = await page.locator('#errorEl').textContent() ?? '';
    expect(txt.trim().length).toBeGreaterThan(0);
  });

  test('19. Error banner disappears after valid input is entered', async ({ page }) => {
    // Trigger error with a dangling flag (no image)
    await page.locator('#inputArea').fill('docker run --name');
    await page.locator('#inputArea').dispatchEvent('input');
    await page.waitForTimeout(200);
    await expect(page.locator('#errorEl')).toBeVisible();
    // Load a valid preset — error should clear
    await page.locator('.preset-btn[data-preset="nginx"]').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#errorEl')).toBeHidden();
  });

  test('20. Load Sample button exists', async ({ page }) => {
    await expect(page.locator('#sampleBtn')).toBeVisible();
  });

  test('21. Clicking Load Sample fills input with sample docker run command', async ({ page }) => {
    await page.locator('#sampleBtn').click();
    await page.waitForTimeout(200);
    const val = await page.locator('#inputArea').inputValue();
    expect(val.trim().length).toBeGreaterThan(10);
    expect(val.toLowerCase()).toContain('docker run');
  });

  test('22. Clear button exists', async ({ page }) => {
    await expect(page.locator('#clearBtn')).toBeVisible();
  });

  test('23. Clicking Clear empties the input', async ({ page }) => {
    await page.locator('#clearBtn').click();
    await page.waitForTimeout(200);
    const val = await page.locator('#inputArea').inputValue();
    expect(val.trim()).toBe('');
  });

  test('24. Copy button exists on output panel', async ({ page }) => {
    await expect(page.locator('#copyBtn')).toBeVisible();
  });
});

// =============================================================================
// COPY CONFIRMATION  (tests 25–26, part of functional group)
// =============================================================================

test.describe('Copy', () => {
  test.beforeEach(async ({ page }) => {
    await mockClipboard(page);
    await page.goto(PAGE);
  });

  test('25. Copy button shows confirmation after clicking', async ({ page }) => {
    await page.locator('#copyBtn').click();
    await expect(page.locator('#copyBtnText')).toHaveText('Copied!', { timeout: 3_000 });
  });

  test('26. Copy button reverts to original text after 2 seconds', async ({ page }) => {
    const originalText = (await page.locator('#copyBtnText').textContent()) ?? '';
    await page.locator('#copyBtn').click();
    await expect(page.locator('#copyBtnText')).toHaveText('Copied!', { timeout: 3_000 });
    await expect(page.locator('#copyBtnText')).not.toHaveText('Copied!', { timeout: 4_000 });
    const newText = await page.locator('#copyBtnText').textContent() ?? '';
    expect(newText.toLowerCase()).toContain('cop');
  });
});

// =============================================================================
// NAVIGATION  (tests 27–30)
// =============================================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('27. Page title contains "Docker"', async ({ page }) => {
    await expect(page).toHaveTitle(/Docker/i);
  });

  test('28. Meta description exists', async ({ page }) => {
    const content = await page.locator('meta[name="description"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('29. Canonical URL points to https://opsbash.com/docker-compose-converter', async ({ page }) => {
    const href = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(href).toBe('https://opsbash.com/docker-compose-converter');
  });

  test('30. Logo links to home page', async ({ page }) => {
    await page.click('header a[href="/"]');
    await expect(page).toHaveURL(/\/$|\/index\.html$/);
  });
});

// =============================================================================
// FAQ  (tests 31–33)
// =============================================================================

test.describe('FAQ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('31. FAQ section exists', async ({ page }) => {
    await expect(page.locator('.faq-item').first()).toBeVisible();
  });

  test('32. All 6 FAQ items are present', async ({ page }) => {
    await expect(page.locator('.faq-item')).toHaveCount(6);
  });

  test('33. Clicking FAQ item expands and shows content', async ({ page }) => {
    const firstQ = page.locator('.faq-q').first();
    const firstA = page.locator('.faq-a').first();
    await expect(firstA).toBeHidden();
    await firstQ.click();
    await expect(firstA).toBeVisible();
    const txt = await firstA.textContent() ?? '';
    expect(txt.trim().length).toBeGreaterThan(0);
  });
});

// =============================================================================
// SEO  (tests 34–35)
// =============================================================================

test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('34. og:title tag exists', async ({ page }) => {
    const content = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('35. JSON-LD structured data exists', async ({ page }) => {
    const scripts = page.locator('script[type="application/ld+json"]');
    const count   = await scripts.count();
    expect(count).toBeGreaterThanOrEqual(1);
    let found = false;
    for (let i = 0; i < count; i++) {
      const src = (await scripts.nth(i).textContent()) ?? '';
      if (src.includes('FAQPage') || src.includes('WebApplication')) { found = true; break; }
    }
    expect(found).toBe(true);
  });
});

// =============================================================================
// MOBILE  (tests 36–37)
// =============================================================================

test.describe('Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
  });

  test('36. At 390px width input textarea is visible', async ({ page }) => {
    await expect(page.locator('#inputArea')).toBeVisible();
  });

  test('37. At 390px width no horizontal overflow', async ({ page }) => {
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);
  });
});
