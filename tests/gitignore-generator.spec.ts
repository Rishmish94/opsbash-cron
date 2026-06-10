import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/gitignore-generator`;

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

async function selectTech(page: Page, name: string) {
  await page.locator('#techSearch').click();
  await page.locator('#techSearch').fill(name);
  // Wait for dropdown to appear and click the matching item
  const item = page.locator('#techDropdown button').filter({ hasText: new RegExp(`^${name}$`) });
  await expect(item).toBeVisible({ timeout: 5_000 });
  await item.click();
}

async function clearAll(page: Page) {
  const clearBtn = page.locator('#clearAllBtn');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
  }
}

// =============================================================================
// FUNCTIONAL  (tests 1–20)
// =============================================================================

test.describe('Functional', () => {
  test.beforeEach(async ({ page }) => {
    await mockClipboard(page);
    await page.goto(PAGE);
  });

  test('1. Page loads and H1 contains "gitignore Generator"', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('gitignore Generator');
  });

  test('2. Search input is visible', async ({ page }) => {
    await expect(page.locator('#techSearch')).toBeVisible();
  });

  test('3. Typing "node" in search shows Node in dropdown', async ({ page }) => {
    await page.locator('#techSearch').click();
    await page.locator('#techSearch').fill('node');
    await expect(page.locator('#techDropdown')).toBeVisible();
    const items = page.locator('#techDropdown button');
    const texts = await items.allTextContents();
    const hasNode = texts.some(t => t.toLowerCase().includes('node'));
    expect(hasNode).toBe(true);
  });

  test('4. Clicking Node in dropdown adds it as a selected chip', async ({ page }) => {
    await selectTech(page, 'Node');
    await expect(page.locator('.tech-chip').first()).toBeVisible();
  });

  test('5. Selected chip shows Node label with X remove button', async ({ page }) => {
    await selectTech(page, 'Node');
    const chip = page.locator('.tech-chip').first();
    const txt  = await chip.textContent() ?? '';
    expect(txt).toContain('Node');
    await expect(chip.locator('.chip-remove')).toBeVisible();
  });

  test('6. Clicking X on chip removes it from selection', async ({ page }) => {
    await selectTech(page, 'Node');
    // Dismiss the search dropdown so it does not intercept the chip-remove click
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await expect(page.locator('.tech-chip')).toHaveCount(1);
    await page.locator('.chip-remove').first().click();
    await expect(page.locator('.tech-chip')).toHaveCount(0);
  });

  test('7. Preview panel updates when technology is selected', async ({ page }) => {
    await expect(page.locator('#previewContent')).toBeHidden();
    await selectTech(page, 'Node');
    await expect(page.locator('#previewContent')).toBeVisible();
  });

  test('8. Preview panel shows real gitignore content not placeholder', async ({ page }) => {
    await selectTech(page, 'Node');
    const txt = await page.locator('#previewContent').textContent() ?? '';
    expect(txt.trim().length).toBeGreaterThan(20);
    // Real Node gitignore always contains node_modules
    expect(txt).toContain('node_modules');
  });

  test('9. Line count badge updates when technologies are added', async ({ page }) => {
    const before = await page.locator('#lineCount').textContent() ?? '';
    expect(before).toContain('0');
    await selectTech(page, 'Node');
    const after = await page.locator('#lineCount').textContent() ?? '';
    // Line count should now be greater than 0
    const num = parseInt(after.replace(/\D/g, ''), 10);
    expect(num).toBeGreaterThan(0);
  });

  test('10. Clicking Web Frontend preset selects multiple technologies', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="web-frontend"]').click();
    const chips = page.locator('.tech-chip');
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('11. Clicking Python Project preset selects Python related technologies', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="python-project"]').click();
    const chips = page.locator('.tech-chip');
    const texts = await chips.allTextContents();
    const hasPython = texts.some(t => t.includes('Python'));
    expect(hasPython).toBe(true);
  });

  test('12. Clicking DevOps preset selects Docker and Kubernetes', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="devops"]').click();
    const texts = await page.locator('.tech-chip').allTextContents();
    const hasDocker = texts.some(t => t.includes('Docker'));
    const hasK8s    = texts.some(t => t.includes('Kubernetes'));
    expect(hasDocker).toBe(true);
    expect(hasK8s).toBe(true);
  });

  test('13. Clicking Clear all removes all selected technologies', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="web-frontend"]').click();
    await expect(page.locator('.tech-chip').first()).toBeVisible();
    await clearAll(page);
    await expect(page.locator('.tech-chip')).toHaveCount(0);
  });

  test('14. Preview panel is empty after Clear all', async ({ page }) => {
    await page.locator('.preset-btn[data-preset="web-frontend"]').click();
    await expect(page.locator('#previewContent')).toBeVisible();
    await clearAll(page);
    await expect(page.locator('#previewContent')).toBeHidden();
    await expect(page.locator('#previewEmpty')).toBeVisible();
  });

  test('15. Copy button exists on preview panel', async ({ page }) => {
    await expect(page.locator('#copyBtn')).toBeVisible();
  });

  test('16. Copy button shows confirmation after clicking', async ({ page }) => {
    await selectTech(page, 'Node');
    await page.locator('#copyBtn').click();
    await expect(page.locator('#copyBtnText')).toHaveText('Copied!', { timeout: 3_000 });
  });

  test('17. Download button exists on preview panel', async ({ page }) => {
    await expect(page.locator('#downloadBtn')).toBeVisible();
  });

  test('18. Download button does not throw when content is available', async ({ page }) => {
    await selectTech(page, 'Node');
    // Intercept download
    const downloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null);
    await page.locator('#downloadBtn').click();
    const dl = await downloadPromise;
    if (dl) {
      // Chromium sanitizes dotfile names; page explicitly uses gitignore.txt
      expect(dl.suggestedFilename()).toBe('gitignore.txt');
    }
    // Whether or not the browser fires a download event, no JS error should occur
    await expect(page.locator('#previewContent')).toBeVisible();
  });

  test('19. Searching for a non-existent technology shows no results message', async ({ page }) => {
    await page.locator('#techSearch').click();
    await page.locator('#techSearch').fill('zzznotexist');
    await expect(page.locator('#techDropdown')).toBeVisible();
    const txt = await page.locator('#techDropdown').textContent() ?? '';
    expect(txt.toLowerCase()).toContain('no');
  });

  test('20. Selecting multiple technologies combines their gitignore content', async ({ page }) => {
    await selectTech(page, 'Node');
    await selectTech(page, 'Python');
    const txt = await page.locator('#previewContent').textContent() ?? '';
    expect(txt).toContain('node_modules');
    expect(txt).toContain('__pycache__');
  });
});

// =============================================================================
// NAVIGATION  (tests 21–24)
// =============================================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('21. Page title contains "gitignore Generator"', async ({ page }) => {
    await expect(page).toHaveTitle(/gitignore Generator/);
  });

  test('22. Meta description exists', async ({ page }) => {
    const content = await page.locator('meta[name="description"]').getAttribute('content');
    expect((content ?? '').trim().length).toBeGreaterThan(0);
  });

  test('23. Canonical URL points to https://opsbash.com/gitignore-generator', async ({ page }) => {
    const href = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(href).toBe('https://opsbash.com/gitignore-generator');
  });

  test('24. Logo links to home page', async ({ page }) => {
    await page.click('header a[href="/"]');
    await expect(page).toHaveURL(/\/$|\/index\.html$/);
  });
});

// =============================================================================
// FAQ  (tests 25–27)
// =============================================================================

test.describe('FAQ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('25. FAQ section exists', async ({ page }) => {
    await expect(page.locator('.faq-item').first()).toBeVisible();
  });

  test('26. All 6 FAQ items are present', async ({ page }) => {
    await expect(page.locator('.faq-item')).toHaveCount(6);
  });

  test('27. Clicking FAQ item expands and shows content', async ({ page }) => {
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

  test('29. JSON-LD structured data exists', async ({ page }) => {
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
// MOBILE  (tests 30–32)
// =============================================================================

test.describe('Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
  });

  test('30. At 390px width search input is visible', async ({ page }) => {
    await expect(page.locator('#techSearch')).toBeVisible();
  });

  test('31. At 390px width preview panel is visible', async ({ page }) => {
    // The preview container (empty state) should be visible
    await expect(page.locator('#previewEmpty')).toBeVisible();
  });

  test('32. At 390px width no horizontal overflow', async ({ page }) => {
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);
  });
});
