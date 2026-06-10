import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/json-yaml-converter`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillInput(page: Page, text: string) {
  await page.fill('#inputArea', text);
}

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

// =============================================================================
// FUNCTIONAL  (tests 1–9)
// =============================================================================

test.describe('Functional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('1. Page loads and H1 contains "JSON to YAML Converter"', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('JSON to YAML Converter');
  });

  test('2. Default sample JSON is visible in the input panel on load', async ({ page }) => {
    const val = await page.locator('#inputArea').inputValue();
    expect(val.trim().length).toBeGreaterThan(0);
    expect(() => JSON.parse(val)).not.toThrow();
  });

  test('3. Input panel converts JSON to YAML automatically without clicking anything', async ({ page }) => {
    const out = await page.locator('#outputArea').inputValue();
    expect(out.trim().length).toBeGreaterThan(0);
  });

  test('4. Output panel shows valid YAML when valid JSON is in input', async ({ page }) => {
    await fillInput(page, '{"key": "value", "num": 42}');
    const out = await page.locator('#outputArea').inputValue();
    expect(out).toContain('key:');
    expect(out).toContain('value');
    expect(out).toContain('num:');
  });

  test('5. Pasting invalid JSON shows a red error message', async ({ page }) => {
    await fillInput(page, '{broken');
    await expect(page.locator('#inputError')).toBeVisible();
    const txt = await page.locator('#inputError').textContent();
    expect((txt ?? '').trim().length).toBeGreaterThan(0);
  });

  test('6. Error message disappears when valid JSON is entered again', async ({ page }) => {
    await fillInput(page, '{broken');
    await expect(page.locator('#inputError')).toBeVisible();
    await fillInput(page, '{"valid": true}');
    await expect(page.locator('#inputError')).toBeHidden();
  });

  test('7. Clicking Load Sample loads a realistic JSON example into the input panel', async ({ page }) => {
    await page.click('#clearBtn');
    await expect(page.locator('#inputArea')).toHaveValue('');
    await page.click('#loadSampleBtn');
    const val = await page.locator('#inputArea').inputValue();
    expect(val.trim().length).toBeGreaterThan(0);
    expect(() => JSON.parse(val)).not.toThrow();
  });

  test('8. Clicking Clear empties the input panel', async ({ page }) => {
    await page.click('#clearBtn');
    await expect(page.locator('#inputArea')).toHaveValue('');
  });

  test('9. After clicking Clear the output panel also clears', async ({ page }) => {
    await page.click('#clearBtn');
    await expect(page.locator('#outputArea')).toHaveValue('');
  });
});

// =============================================================================
// TOGGLE  (tests 10–15)
// =============================================================================

test.describe('Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('10. Default mode shows "JSON to YAML" on the toggle button', async ({ page }) => {
    await expect(page.locator('#directionToggle')).toHaveText('JSON to YAML');
  });

  test('11. Clicking toggle switches to "YAML to JSON" mode', async ({ page }) => {
    await page.click('#directionToggle');
    await expect(page.locator('#directionToggle')).toHaveText('YAML to JSON');
  });

  test('12. In YAML to JSON mode the input label changes to "YAML Input"', async ({ page }) => {
    await page.click('#directionToggle');
    await expect(page.locator('#inputLabel')).toHaveText('YAML Input');
  });

  test('13. In YAML to JSON mode the output label changes to "JSON Output"', async ({ page }) => {
    await page.click('#directionToggle');
    await expect(page.locator('#outputLabel')).toHaveText('JSON Output');
  });

  test('14. Valid YAML input in YAML to JSON mode produces valid JSON output', async ({ page }) => {
    await page.click('#directionToggle');
    await fillInput(page, 'name: test\nversion: 1\nactive: true\n');
    const out = await page.locator('#outputArea').inputValue();
    expect(() => JSON.parse(out)).not.toThrow();
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed['name']).toBe('test');
    expect(parsed['version']).toBe(1);
    expect(parsed['active']).toBe(true);
  });

  test('15. Clicking toggle again switches back to JSON to YAML mode', async ({ page }) => {
    await page.click('#directionToggle');
    await expect(page.locator('#directionToggle')).toHaveText('YAML to JSON');
    await page.click('#directionToggle');
    await expect(page.locator('#directionToggle')).toHaveText('JSON to YAML');
  });
});

// =============================================================================
// INDENTATION  (tests 16–18)
// =============================================================================

test.describe('Indentation', () => {
  // Use a JSON with nested keys so indentation is visible in the YAML output
  const NESTED_JSON = '{"server":{"host":"0.0.0.0","port":8080}}';

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await fillInput(page, NESTED_JSON);
  });

  test('16. Default indentation is 2 spaces', async ({ page }) => {
    const out = await page.locator('#outputArea').inputValue();
    // Nested keys appear at exactly 2-space indent: "  host:" not "    host:"
    expect(out).toMatch(/^  \S/m);
    expect(out).not.toMatch(/^    \S/m);
  });

  test('17. Clicking 4 spaces changes output indentation to 4 spaces', async ({ page }) => {
    await page.click('#indent4Btn');
    const out = await page.locator('#outputArea').inputValue();
    // Nested keys now appear at 4-space indent
    expect(out).toMatch(/^    \S/m);
  });

  test('18. Clicking 2 spaces switches back to 2 space indentation', async ({ page }) => {
    await page.click('#indent4Btn');
    await page.click('#indent2Btn');
    const out = await page.locator('#outputArea').inputValue();
    expect(out).toMatch(/^  \S/m);
    expect(out).not.toMatch(/^    \S/m);
  });
});

// =============================================================================
// COPY  (tests 19–20)
// =============================================================================

test.describe('Copy', () => {
  test.beforeEach(async ({ page }) => {
    await mockClipboard(page);
    await page.goto(PAGE);
  });

  test('19. Copy button exists on the output panel', async ({ page }) => {
    await expect(page.locator('#copyBtn')).toBeVisible();
  });

  test('20. Copy button shows a confirmation state after clicking', async ({ page }) => {
    // Output is pre-loaded via sample; ensure it is non-empty before copying
    await expect(page.locator('#outputArea')).not.toHaveValue('');
    await page.click('#copyBtn');
    await expect(page.locator('#copyBtnText')).toHaveText('Copied!', { timeout: 3_000 });
  });
});

// =============================================================================
// DARK MODE  (tests 21–23)
// =============================================================================

test.describe('Dark Mode', () => {
  test('21. Page has dark background — html element has class "dark"', async ({ page }) => {
    await page.goto(PAGE);
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(true);
  });

  test('22. No light mode toggle exists — no #darkToggle or theme toggle button', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('#darkToggle')).toHaveCount(0);
    // Also confirm no generic theme-toggle button exists
    const toggleCount = await page.locator('[aria-label*="theme" i], [aria-label*="dark mode" i]').count();
    expect(toggleCount).toBe(0);
  });

  test('23. Dark mode is permanent — html still has class "dark" after reload', async ({ page }) => {
    await page.goto(PAGE);
    await page.reload();
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(true);
  });
});

// =============================================================================
// NAVIGATION  (tests 24–26)
// =============================================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('24. Logo click goes to the home page', async ({ page }) => {
    await page.click('header a[href="/"]');
    await expect(page).toHaveURL(/\/$|\/index\.html$/);
  });

  test('25. Cron Builder nav link goes to /cron-builder', async ({ page }) => {
    await page.click('header a[href="/cron-builder"]');
    await expect(page).toHaveURL(/\/cron-builder(\/)?$/);
  });

  test('26. JSON YAML nav link goes to /json-yaml-converter', async ({ page }) => {
    await page.goto(BASE);
    await page.click('header a[href="/json-yaml-converter"]');
    await expect(page).toHaveURL(/\/json-yaml-converter(\/)?$/);
  });
});

// =============================================================================
// MOBILE  (tests 27–30)
// =============================================================================

test.describe('Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
  });

  test('27. At 390px width the input panel is visible', async ({ page }) => {
    await expect(page.locator('#inputArea')).toBeVisible();
  });

  test('28. At 390px width the output panel is visible', async ({ page }) => {
    await expect(page.locator('#outputArea')).toBeVisible();
  });

  test('29. At 390px width no horizontal overflow exists', async ({ page }) => {
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);
  });

  test('30. At 390px width the toggle button is visible', async ({ page }) => {
    await expect(page.locator('#directionToggle')).toBeVisible();
  });
});

// =============================================================================
// FAQ  (tests 31–33)
// =============================================================================

test.describe('FAQ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('31. FAQ section exists on the page', async ({ page }) => {
    await expect(page.locator('.faq-item').first()).toBeVisible();
  });

  test('32. Clicking a FAQ item expands it and shows non-empty content', async ({ page }) => {
    const firstQ = page.locator('.faq-q').first();
    const firstA = page.locator('.faq-a').first();
    // Answers start collapsed
    await expect(firstA).toBeHidden();
    await firstQ.click();
    await expect(firstA).toBeVisible();
    const txt = await firstA.textContent();
    expect((txt ?? '').trim().length).toBeGreaterThan(0);
  });

  test('33. All 6 FAQ items are present on the page', async ({ page }) => {
    await expect(page.locator('.faq-item')).toHaveCount(6);
  });
});

// =============================================================================
// SEO  (tests 34–38)
// =============================================================================

test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('34. Page title contains "JSON to YAML Converter"', async ({ page }) => {
    await expect(page).toHaveTitle(/JSON to YAML Converter/);
  });

  test('35. Meta description exists and is not empty', async ({ page }) => {
    const content = await page.locator('meta[name="description"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('36. Canonical URL points to https://opsbash.com/json-yaml-converter', async ({ page }) => {
    const href = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(href).toBe('https://opsbash.com/json-yaml-converter');
  });

  test('37. og:title tag exists and is not empty', async ({ page }) => {
    const content = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('38. JSON-LD FAQPage structured data exists in the page', async ({ page }) => {
    const scripts = page.locator('script[type="application/ld+json"]');
    const count   = await scripts.count();
    expect(count).toBeGreaterThanOrEqual(1);
    let hasFaqPage = false;
    for (let i = 0; i < count; i++) {
      const src = await scripts.nth(i).textContent() ?? '';
      if (src.includes('FAQPage')) { hasFaqPage = true; break; }
    }
    expect(hasFaqPage).toBe(true);
  });
});
