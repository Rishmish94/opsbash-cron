import { test, expect } from '@playwright/test';

const PAGE_URL = process.env.BASE_URL ?? 'http://localhost:4321/cron-builder';
const BASE_URL = new URL(PAGE_URL).origin;

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONAL TESTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Functional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
  });

  test('1. H1 says "Free Cron Expression Generator"', async ({ page }) => {
    await expect(page.locator('h1').first()).toHaveText('Free Cron Expression Generator');
  });

  test('2. Default "* * * * *" shows "every minute" in plain English', async ({ page }) => {
    await expect(page.locator('#explanation')).toContainText('every minute');
  });

  test('3. "*/5 * * * *" shows "5 minutes" in plain English', async ({ page }) => {
    await page.fill('#cronInput', '*/5 * * * *');
    await expect(page.locator('#explanation')).toContainText('5 minutes');
  });

  test('4. "0 9 * * 1-5" shows weekday mention in plain English', async ({ page }) => {
    await page.fill('#cronInput', '0 9 * * 1-5');
    const text = await page.locator('#explanation').textContent();
    expect(text ?? '').toMatch(/Mon|Fri|weekday/i);
  });

  test('5. "99 99 99 99 99" shows an error message', async ({ page }) => {
    await page.fill('#cronInput', '99 99 99 99 99');
    await expect(page.locator('#cronError')).toBeVisible();
    const errText = await page.locator('#cronError').textContent();
    expect((errText ?? '').trim().length).toBeGreaterThan(0);
  });

  test('6. Clicking "Every minute" preset sets expression to "* * * * *"', async ({ page }) => {
    await page.click('[data-preset="* * * * *"]');
    await expect(page.locator('#cronInput')).toHaveValue('* * * * *');
  });

  test('7. Clicking "Daily at midnight" preset sets expression to "0 0 * * *"', async ({ page }) => {
    await page.click('[data-preset="0 0 * * *"]');
    await expect(page.locator('#cronInput')).toHaveValue('0 0 * * *');
  });

  test('8. Next 10 runs section shows exactly 10 future dates', async ({ page }) => {
    await expect(page.locator('#nextRuns li')).toHaveCount(10);

    const allFuture = await page.evaluate(() => {
      const now  = Date.now();
      const year = new Date().getFullYear();
      const items = document.querySelectorAll('#nextRuns li');
      return Array.from(items).every(li => {
        const raw = (li.textContent ?? '').trim();
        const m   = raw.match(/\w+,\s+(\w+\s+\d+),\s+(.+)/);
        if (!m) return false;
        const d = new Date(`${m[1]} ${year} ${m[2]}`);
        return !isNaN(d.getTime()) && d.getTime() > now - 60_000;
      });
    });

    expect(allFuture).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM SWITCHING TESTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Platform Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
  });

  test('9. Linux/Unix tab is active by default', async ({ page }) => {
    await expect(page.locator('[data-platform="linux"]')).toHaveClass(/active-tab/);
    for (const p of ['aws', 'github', 'k8s']) {
      const cls = await page.locator(`[data-platform="${p}"]`).getAttribute('class') ?? '';
      expect(cls).not.toContain('active-tab');
    }
  });

  test('10. Clicking AWS CloudWatch tab shows 6-field format', async ({ page }) => {
    await page.click('[data-platform="aws"]');
    await expect(page.locator('#platformCode')).toBeVisible();
    await expect(page.locator('#platformCode')).toContainText('cron(');
    const code  = await page.locator('#platformCode').textContent() ?? '';
    const inner = code.match(/cron\((.+?)\)/)?.[1] ?? '';
    expect(inner.trim().split(/\s+/).length).toBe(6);
  });

  test('11. Clicking GitHub Actions tab shows "schedule:" in output', async ({ page }) => {
    await page.click('[data-platform="github"]');
    await expect(page.locator('#platformCode')).toBeVisible();
    await expect(page.locator('#platformCode')).toContainText('schedule:');
  });

  test('12. Clicking Kubernetes tab shows "apiVersion: batch/v1"', async ({ page }) => {
    await page.click('[data-platform="k8s"]');
    await expect(page.locator('#platformCode')).toBeVisible();
    await expect(page.locator('#platformCode')).toContainText('apiVersion: batch/v1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UI TESTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UI', () => {
  test('13. Dark mode is permanent — html element has class "dark"', async ({ page }) => {
    await page.goto(PAGE_URL);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);
  });

  test('14. Copy button shows confirmation after clicking', async ({ page }) => {
    await page.addInitScript(() => {
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') },
          configurable: true,
        });
      }
    });
    await page.goto(PAGE_URL);
    await page.click('#copyBtn');
    await expect(page.locator('#copyLabel')).toHaveText('Copied!');
    await expect(page.locator('#copyLabel')).toHaveText('Copy', { timeout: 4_000 });
  });

  test('15. All FAQ items expand and show non-empty content', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(PAGE_URL);

    // The page has two page-level tabs (Cron Builder / Cron to systemd Timer),
    // each with its own FAQ accordion. Only the active tab's FAQ items are
    // visible in the DOM, so each section must be scoped and activated in turn.
    const sections = [
      { tabButton: null, container: '#tab-cron-builder' },
      { tabButton: '#page-tab-systemd', container: '#tab-systemd' },
    ];

    for (const section of sections) {
      if (section.tabButton) {
        await page.click(section.tabButton);
      }
      const items = page.locator(`${section.container} .faq-item`);
      const triggers = page.locator(`${section.container} .faq-trigger`);
      const count = await items.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const content = items.nth(i).locator('.faq-content');
        await expect(content).toBeHidden({ timeout: 5000 });
        await triggers.nth(i).click();
        await content.waitFor({ state: 'visible', timeout: 8000 });
        const text = (await content.textContent() ?? '').trim();
        expect(text.length).toBeGreaterThan(20);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
  });

  test('16. Footer About link goes to /about', async ({ page }) => {
    await page.click('footer a[href="/about"]');
    await expect(page).toHaveURL(/\/about\/?$/);
  });

  test('17. Footer Privacy Policy link goes to /privacy-policy', async ({ page }) => {
    await page.click('footer a[href="/privacy-policy"]');
    await expect(page).toHaveURL(/\/privacy-policy\/?$/);
  });

  test('18. Footer Terms link goes to /terms', async ({ page }) => {
    await page.click('footer a[href="/terms"]');
    await expect(page).toHaveURL(/\/terms\/?$/);
  });

  test('19. Footer Contact link goes to /contact', async ({ page }) => {
    await page.click('footer a[href="/contact"]');
    await expect(page).toHaveURL(/\/contact\/?$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE TESTS  (390 × 844 — iPhone 14 Pro)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mobile (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
  });

  test('20. At 390px width all dropdowns are visible', async ({ page }) => {
    for (const id of ['selMinute', 'selHour', 'selDay', 'selMonth', 'selWeekday']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('21. At 390px no horizontal overflow', async ({ page }) => {
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasOverflow).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEO TESTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
  });

  test('22. Page title contains "Cron Expression Generator"', async ({ page }) => {
    await expect(page).toHaveTitle(/Cron Expression Generator/i);
  });

  test('23. Meta description exists', async ({ page }) => {
    const desc = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect((desc ?? '').trim().length).toBeGreaterThan(20);
  });

  test('24. sitemap.xml is accessible', async ({ page }) => {
    const resp = await page.request.get(`${BASE_URL}/sitemap.xml`);
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('/cron-builder');
  });

  test('25. robots.txt is accessible', async ({ page }) => {
    const resp = await page.request.get(`${BASE_URL}/robots.txt`);
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    expect(body).toContain('User-agent');
  });
});
