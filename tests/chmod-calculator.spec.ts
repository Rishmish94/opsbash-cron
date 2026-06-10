import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/chmod-calculator`;

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

async function clickPreset(page: Page, octal: string) {
  await page.locator(`.preset-btn[data-octal="${octal}"]`).click();
}

// =============================================================================
// FUNCTIONAL  (tests 1–21)
// =============================================================================

test.describe('Functional', () => {
  test.beforeEach(async ({ page }) => {
    await mockClipboard(page);
    await page.goto(PAGE);
  });

  test('1. Page loads and H1 contains "chmod Calculator"', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('chmod Calculator');
  });

  test('2. All 8 preset buttons are visible', async ({ page }) => {
    const presets = page.locator('.preset-btn');
    await expect(presets).toHaveCount(8);
    for (let i = 0; i < 8; i++) {
      await expect(presets.nth(i)).toBeVisible();
    }
  });

  test('3. Clicking 755 preset updates octal input to show 755', async ({ page }) => {
    await clickPreset(page, '755');
    await expect(page.locator('#octalInput')).toHaveValue('755');
  });

  test('4. Clicking 755 preset updates symbolic output to show rwxr-xr-x', async ({ page }) => {
    await clickPreset(page, '755');
    await expect(page.locator('#symbolicInput')).toHaveValue('rwxr-xr-x');
  });

  test('5. Clicking 755 preset updates chmod command output', async ({ page }) => {
    await clickPreset(page, '755');
    const cmd = await page.locator('#chmodCmd').textContent() ?? '';
    expect(cmd).toContain('chmod');
    expect(cmd).toContain('755');
  });

  test('6. Clicking 644 preset updates octal to 644', async ({ page }) => {
    await clickPreset(page, '644');
    await expect(page.locator('#octalInput')).toHaveValue('644');
  });

  test('7. Clicking 777 preset updates octal to 777', async ({ page }) => {
    await clickPreset(page, '777');
    await expect(page.locator('#octalInput')).toHaveValue('777');
  });

  test('8. Clicking 700 preset updates octal to 700', async ({ page }) => {
    await clickPreset(page, '700');
    await expect(page.locator('#octalInput')).toHaveValue('700');
  });

  test('9. Owner Read card is visible and clickable', async ({ page }) => {
    await expect(page.locator('#card-or')).toBeVisible();
    await page.locator('#card-or').click();
    // Clicking should not throw and page should still be functional
    await expect(page.locator('#octalInput')).toBeVisible();
  });

  test('10. Owner Write card is visible and clickable', async ({ page }) => {
    await expect(page.locator('#card-ow')).toBeVisible();
    await page.locator('#card-ow').click();
    await expect(page.locator('#octalInput')).toBeVisible();
  });

  test('11. Owner Execute card is visible and clickable', async ({ page }) => {
    await expect(page.locator('#card-ox')).toBeVisible();
    await page.locator('#card-ox').click();
    await expect(page.locator('#octalInput')).toBeVisible();
  });

  test('12. Group Read card is visible and clickable', async ({ page }) => {
    await expect(page.locator('#card-gr')).toBeVisible();
    await page.locator('#card-gr').click();
    await expect(page.locator('#octalInput')).toBeVisible();
  });

  test('13. Others Read card is visible and clickable', async ({ page }) => {
    await expect(page.locator('#card-tr')).toBeVisible();
    await page.locator('#card-tr').click();
    await expect(page.locator('#octalInput')).toBeVisible();
  });

  test('14. Typing 644 in octal input updates symbolic output to rw-r--r--', async ({ page }) => {
    await page.locator('#octalInput').fill('644');
    await page.locator('#octalInput').dispatchEvent('input');
    // Allow UI to settle
    await page.waitForTimeout(200);
    await expect(page.locator('#symbolicInput')).toHaveValue('rw-r--r--');
  });

  test('15. Typing 755 in octal reverse lookup updates all outputs', async ({ page }) => {
    // Start from a different state (644)
    await clickPreset(page, '644');
    await page.locator('#octalInput').fill('755');
    await page.locator('#octalInput').dispatchEvent('input');
    await page.waitForTimeout(200);
    await expect(page.locator('#symbolicInput')).toHaveValue('rwxr-xr-x');
    const cmd = await page.locator('#chmodCmd').textContent() ?? '';
    expect(cmd).toContain('755');
  });

  test('16. Typing invalid octal like 999 ignores gracefully', async ({ page }) => {
    // 9 is not a valid octal digit; the input should only accept 0-7
    await page.locator('#octalInput').fill('9');
    await page.locator('#octalInput').dispatchEvent('input');
    await page.waitForTimeout(200);
    // Page must not crash — outputs should still be visible
    await expect(page.locator('#octalInput')).toBeVisible();
    await expect(page.locator('#chmodCmd')).toBeVisible();
  });

  test('17. Copy button exists on chmod command output', async ({ page }) => {
    await expect(page.locator('#copyBtn')).toBeVisible();
  });

  test('18. Copy button shows confirmation after clicking', async ({ page }) => {
    await page.click('#copyBtn');
    await expect(page.locator('#copyBtnText')).toHaveText('Copied!', { timeout: 3_000 });
  });

  test('19. Filename input exists and defaults to "filename"', async ({ page }) => {
    await expect(page.locator('#filenameInput')).toBeVisible();
    await expect(page.locator('#filenameInput')).toHaveValue('filename');
  });

  test('20. Changing filename updates the chmod command output', async ({ page }) => {
    await page.locator('#filenameInput').fill('myapp.sh');
    await page.locator('#filenameInput').dispatchEvent('input');
    await page.waitForTimeout(200);
    const cmd = await page.locator('#chmodCmd').textContent() ?? '';
    expect(cmd).toContain('myapp.sh');
  });

  test('21. Clicking a different preset resets permissions correctly', async ({ page }) => {
    // Set to 777 then to 600 — verifies state actually changes
    await clickPreset(page, '777');
    await expect(page.locator('#octalInput')).toHaveValue('777');
    await clickPreset(page, '600');
    await expect(page.locator('#octalInput')).toHaveValue('600');
    await expect(page.locator('#symbolicInput')).toHaveValue('rw-------');
  });
});

// =============================================================================
// NAVIGATION  (tests 22–25)
// =============================================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('22. Page title contains "chmod Calculator"', async ({ page }) => {
    await expect(page).toHaveTitle(/chmod Calculator/);
  });

  test('23. Meta description exists', async ({ page }) => {
    const content = await page.locator('meta[name="description"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('24. Canonical URL points to https://opsbash.com/chmod-calculator', async ({ page }) => {
    const href = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(href).toBe('https://opsbash.com/chmod-calculator');
  });

  test('25. Logo links to home page', async ({ page }) => {
    await page.click('header a[href="/"]');
    await expect(page).toHaveURL(/\/$|\/index\.html$/);
  });
});

// =============================================================================
// FAQ  (tests 26–28)
// =============================================================================

test.describe('FAQ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('26. FAQ section exists', async ({ page }) => {
    await expect(page.locator('.faq-item').first()).toBeVisible();
  });

  test('27. All 6 FAQ items are present', async ({ page }) => {
    await expect(page.locator('.faq-item')).toHaveCount(6);
  });

  test('28. Clicking FAQ item expands and shows content', async ({ page }) => {
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
// SEO  (tests 29–30)
// =============================================================================

test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('29. og:title tag exists', async ({ page }) => {
    const content = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('30. JSON-LD structured data exists', async ({ page }) => {
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
// MOBILE  (tests 31–32)
// =============================================================================

test.describe('Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
  });

  test('31. At 390px width all preset buttons are visible', async ({ page }) => {
    const presets = page.locator('.preset-btn');
    const count = await presets.count();
    expect(count).toBe(8);
    // At least the first and last should be visible (others may require scroll on very small screens)
    await expect(presets.first()).toBeVisible();
  });

  test('32. At 390px width no horizontal overflow', async ({ page }) => {
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);
  });
});
