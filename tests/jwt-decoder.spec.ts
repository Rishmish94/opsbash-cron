import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/jwt-decoder`;

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

// A well-known expired JWT (exp = 1516239022 = Jan 2018)
const EXPIRED_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// =============================================================================
// FUNCTIONAL  (tests 1–18)
// =============================================================================

test.describe('Functional', () => {
  test.beforeEach(async ({ page }) => {
    await mockClipboard(page);
    await page.goto(PAGE);
  });

  test('1. Page loads and H1 contains "JWT Token Decoder"', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('JWT Token Decoder');
  });

  test('2. Input textarea is visible and accepts text', async ({ page }) => {
    const input = page.locator('#jwtInput');
    await expect(input).toBeVisible();
    await input.fill('test');
    await expect(input).toHaveValue('test');
  });

  test('3. Load Sample button loads a valid JWT into the input', async ({ page }) => {
    await page.click('#sampleBtn');
    const val = await page.locator('#jwtInput').inputValue();
    expect(val.trim().length).toBeGreaterThan(0);
    // A JWT has exactly two dots
    expect(val.split('.').length).toBe(3);
  });

  test('4. After loading sample, Header card appears with decoded content', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#outputSection')).toBeVisible();
    const headerText = await page.locator('#headerOutput').textContent() ?? '';
    expect(headerText.trim().length).toBeGreaterThan(0);
    expect(headerText).toContain('alg');
  });

  test('5. After loading sample, Payload card appears with decoded content', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#outputSection')).toBeVisible();
    const payloadText = await page.locator('#payloadOutput').textContent() ?? '';
    expect(payloadText.trim().length).toBeGreaterThan(0);
    expect(payloadText).toContain('sub');
  });

  test('6. After loading sample, Signature card appears', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#outputSection')).toBeVisible();
    await expect(page.locator('#signatureOutput')).toBeVisible();
    const sigText = await page.locator('#signatureOutput').textContent() ?? '';
    expect(sigText.trim().length).toBeGreaterThan(0);
  });

  test('7. Algorithm badge is visible after loading sample', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#algBadge')).toBeVisible();
    const txt = await page.locator('#algBadge').textContent() ?? '';
    expect(txt).toContain('Algorithm');
  });

  test('8. Token status banner appears after loading sample', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#statusRow')).toBeVisible();
    await expect(page.locator('#statusBanner')).toBeVisible();
  });

  test('9. Valid token shows valid status in status banner', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#statusBanner')).toBeVisible();
    const txt = await page.locator('#statusBanner').textContent() ?? '';
    expect(txt).toContain('Valid');
  });

  test('10. Expired token shows expired status in status banner', async ({ page }) => {
    await page.locator('#jwtInput').fill(EXPIRED_JWT);
    await expect(page.locator('#statusBanner')).toBeVisible();
    const txt = await page.locator('#statusBanner').textContent() ?? '';
    expect(txt).toContain('Expired');
  });

  test('11. exp claim shows human readable date', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#specialClaims')).toBeVisible();
    const txt = await page.locator('#specialClaims').textContent() ?? '';
    // A human-readable date contains a four-digit year
    expect(txt).toMatch(/\d{4}/);
  });

  test('12. iat claim shows human readable date', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('#specialClaims')).toBeVisible();
    const txt = await page.locator('#specialClaims').textContent() ?? '';
    expect(txt).toMatch(/\d{4}/);
  });

  test('13. Pasting invalid text shows an error message', async ({ page }) => {
    await page.locator('#jwtInput').fill('not.a.jwt.at.all');
    await expect(page.locator('#errorMsg')).toBeVisible();
    const txt = await page.locator('#errorMsg').textContent() ?? '';
    expect(txt.trim().length).toBeGreaterThan(0);
  });

  test('14. Error message disappears when valid JWT is pasted', async ({ page }) => {
    await page.locator('#jwtInput').fill('this.is.invalid');
    await expect(page.locator('#errorMsg')).toBeVisible();
    await page.click('#sampleBtn');
    await expect(page.locator('#errorMsg')).toBeHidden();
  });

  test('15. Copy button exists on Header card', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('[data-copy="header"]')).toBeVisible();
  });

  test('16. Copy button exists on Payload card', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('[data-copy="payload"]')).toBeVisible();
  });

  test('17. Copy button exists on Signature card', async ({ page }) => {
    await page.click('#sampleBtn');
    await expect(page.locator('[data-copy="signature"]')).toBeVisible();
  });

  test('18. Copy button shows confirmation after clicking', async ({ page }) => {
    await page.click('#sampleBtn');
    const copyBtn = page.locator('[data-copy="header"]');
    await copyBtn.click();
    await expect(copyBtn).toHaveText('Copied!', { timeout: 3_000 });
  });
});

// =============================================================================
// NAVIGATION  (tests 19–24)
// =============================================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('19. Page title contains "JWT Decoder"', async ({ page }) => {
    await expect(page).toHaveTitle(/JWT Decoder/);
  });

  test('20. Meta description exists and is not empty', async ({ page }) => {
    const content = await page.locator('meta[name="description"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('21. Canonical URL points to https://opsbash.com/jwt-decoder', async ({ page }) => {
    const href = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(href).toBe('https://opsbash.com/jwt-decoder');
  });

  test('22. Logo links to home page', async ({ page }) => {
    await page.click('header a[href="/"]');
    await expect(page).toHaveURL(/\/$|\/index\.html$/);
  });

  test('23. Cron Builder nav link goes to /cron-builder', async ({ page }) => {
    await page.click('header a[href="/cron-builder"]');
    await expect(page).toHaveURL(/\/cron-builder(\/)?$/);
  });

  test('24. JSON YAML nav link goes to /json-yaml-converter', async ({ page }) => {
    await page.click('header a[href="/json-yaml-converter"]');
    await expect(page).toHaveURL(/\/json-yaml-converter(\/)?$/);
  });
});

// =============================================================================
// FAQ  (tests 25–27)
// =============================================================================

test.describe('FAQ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('25. FAQ section exists on page', async ({ page }) => {
    await expect(page.locator('.faq-item').first()).toBeVisible();
  });

  test('26. All 6 FAQ items are present', async ({ page }) => {
    await expect(page.locator('.faq-item')).toHaveCount(6);
  });

  test('27. Clicking FAQ item expands it and shows non-empty content', async ({ page }) => {
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
// SEO  (tests 28–29)
// =============================================================================

test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('28. og:title tag exists', async ({ page }) => {
    const content = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('29. JSON-LD structured data exists in page', async ({ page }) => {
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
// MOBILE  (tests 30–31)
// =============================================================================

test.describe('Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
  });

  test('30. At 390px width input textarea is visible', async ({ page }) => {
    await expect(page.locator('#jwtInput')).toBeVisible();
  });

  test('31. At 390px width no horizontal overflow exists', async ({ page }) => {
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);
  });
});
