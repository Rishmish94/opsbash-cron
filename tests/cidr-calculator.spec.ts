import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/cidr-calculator`;

// ── shared helper ─────────────────────────────────────────────────────────────
async function enterCIDR(page: Page, cidr: string) {
  await page.fill('#cidrInput', cidr);
}

// ── clipboard mock (paste into beforeEach for copy tests) ─────────────────────
async function mockClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') },
      configurable: true,
      writable: true,
    });
  });
}

// =============================================================================
// FUNCTIONAL (tests 1–10)
// =============================================================================

test.describe('Functional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('1. Page loads and H1 contains "CIDR"', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('CIDR');
  });

  test('2. Default 192.168.1.0/24 — Total Hosts is 256', async ({ page }) => {
    await expect(page.locator('#statTotal')).toHaveText('256');
  });

  test('3. Default 192.168.1.0/24 — Usable Hosts is 254', async ({ page }) => {
    await expect(page.locator('#statUsable')).toHaveText('254');
  });

  test('4. Default 192.168.1.0/24 — Network Class is "Class C"', async ({ page }) => {
    await expect(page.locator('#statClass')).toHaveText('Class C');
  });

  test('5. Default — Network Address is 192.168.1.0', async ({ page }) => {
    await expect(page.locator('#dNetAddr')).toHaveText('192.168.1.0');
  });

  test('6. Default — Broadcast Address is 192.168.1.255', async ({ page }) => {
    await expect(page.locator('#dBcast')).toHaveText('192.168.1.255');
  });

  test('7. Default — Subnet Mask is 255.255.255.0', async ({ page }) => {
    await expect(page.locator('#dMask')).toHaveText('255.255.255.0');
  });

  test('8. Default — Wildcard Mask is 0.0.0.255', async ({ page }) => {
    await expect(page.locator('#dWild')).toHaveText('0.0.0.255');
  });

  test('9. Default — First Usable IP is 192.168.1.1', async ({ page }) => {
    await expect(page.locator('#dFirst')).toHaveText('192.168.1.1');
  });

  test('10. Default — Last Usable IP is 192.168.1.254', async ({ page }) => {
    await expect(page.locator('#dLast')).toHaveText('192.168.1.254');
  });
});

// =============================================================================
// INPUT (tests 11–15)
// =============================================================================

test.describe('Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('11. Typing 10.0.0.0/8 — Total Hosts is 16,777,216', async ({ page }) => {
    await enterCIDR(page, '10.0.0.0/8');
    await expect(page.locator('#statTotal')).toHaveText('16,777,216');
  });

  test('12. Typing 10.0.0.0/8 — Network Class is "Class A"', async ({ page }) => {
    await enterCIDR(page, '10.0.0.0/8');
    await expect(page.locator('#statClass')).toHaveText('Class A');
  });

  test('13. Typing 172.16.0.0/12 — Network Class is "Class B"', async ({ page }) => {
    await enterCIDR(page, '172.16.0.0/12');
    await expect(page.locator('#statClass')).toHaveText('Class B');
  });

  test('14. Invalid "999.999.999.999/24" — error message is visible', async ({ page }) => {
    await enterCIDR(page, '999.999.999.999/24');
    await expect(page.locator('#cidrError')).toBeVisible();
    const txt = await page.locator('#cidrError').textContent();
    expect((txt ?? '').trim().length).toBeGreaterThan(0);
  });

  test('15. IPv6 2001:db8::/32 — IPv6 badge appears', async ({ page }) => {
    await enterCIDR(page, '2001:db8::/32');
    await expect(page.locator('#ipvBadge')).toBeVisible();
    await expect(page.locator('#ipvBadge')).toContainText('IPv6');
  });
});

// =============================================================================
// PRESETS (tests 16–18)
// =============================================================================

test.describe('Presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('16. Clicking "192.168.1.0/24 — Home network" preset loads that value', async ({ page }) => {
    await page.click('[data-cidr="192.168.1.0/24"]');
    await expect(page.locator('#cidrInput')).toHaveValue('192.168.1.0/24');
    await expect(page.locator('#dNetAddr')).toHaveText('192.168.1.0');
  });

  test('17. Clicking "10.0.0.0/8 — Private class A" preset loads that value', async ({ page }) => {
    await page.click('[data-cidr="10.0.0.0/8"]');
    await expect(page.locator('#cidrInput')).toHaveValue('10.0.0.0/8');
    await expect(page.locator('#statClass')).toHaveText('Class A');
  });

  test('18. Clicking IPv6 preset shows IPv6 badge', async ({ page }) => {
    await page.click('[data-cidr="2001:db8::/32"]');
    await expect(page.locator('#ipvBadge')).toBeVisible();
    await expect(page.locator('#ipvBadge')).toContainText('IPv6');
  });
});

// =============================================================================
// SUBNET SPLITTER (tests 19–21)
// =============================================================================

test.describe('Subnet Splitter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.fill('#splitInput', '10.0.0.0/16');
  });

  test('19. 10.0.0.0/16 ÷ 2 — shows exactly 2 subnets', async ({ page }) => {
    await page.click('.split-count-btn[data-count="2"]');
    await expect(page.locator('#splitResults table tbody tr')).toHaveCount(2);
  });

  test('20. 10.0.0.0/16 ÷ 4 — shows exactly 4 subnets', async ({ page }) => {
    await page.click('.split-count-btn[data-count="4"]');
    await expect(page.locator('#splitResults table tbody tr')).toHaveCount(4);
  });

  test('21. 10.0.0.0/16 ÷ 8 — shows exactly 8 subnets', async ({ page }) => {
    await page.click('.split-count-btn[data-count="8"]');
    await expect(page.locator('#splitResults table tbody tr')).toHaveCount(8);
  });
});

// =============================================================================
// AWS VPC PLANNER (tests 22–24)
// =============================================================================

test.describe('VPC Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('22. Default — shows 2 subnets with Public and Private tiers', async ({ page }) => {
    const rows = page.locator('#vpcResults table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Public');
    await expect(rows.nth(1)).toContainText('Private');
  });

  test('23. Clicking "4 subnets" — shows exactly 4 rows', async ({ page }) => {
    await page.click('.vpc-count-btn[data-count="4"]');
    await expect(page.locator('#vpcResults table tbody tr')).toHaveCount(4);
  });

  test('24. Each VPC row contains a valid CIDR notation', async ({ page }) => {
    await page.click('.vpc-count-btn[data-count="4"]');
    const rows = page.locator('#vpcResults table tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent() ?? '';
      expect(text).toMatch(/\d+\.\d+\.\d+\.\d+\/\d+/);
    }
  });
});

// =============================================================================
// SCENARIO 1 — DevOps engineer planning an AWS VPC (tests 25–31)
// =============================================================================

test.describe('Scenario 1 — AWS VPC Planning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('25. 10.0.0.0/16 — Total Hosts shows 65,536', async ({ page }) => {
    await enterCIDR(page, '10.0.0.0/16');
    await expect(page.locator('#statTotal')).toHaveText('65,536');
  });

  test('26. 10.0.0.0/16 — Usable Hosts shows 65,534', async ({ page }) => {
    await enterCIDR(page, '10.0.0.0/16');
    await expect(page.locator('#statUsable')).toHaveText('65,534');
  });

  test('27. VPC Planner — clicking "4 subnets" produces a result table', async ({ page }) => {
    await page.click('.vpc-count-btn[data-count="4"]');
    await expect(page.locator('#vpcResults table')).toBeVisible();
  });

  test('28. VPC Planner — exactly 4 rows appear after clicking "4 subnets"', async ({ page }) => {
    await page.click('.vpc-count-btn[data-count="4"]');
    await expect(page.locator('#vpcResults table tbody tr')).toHaveCount(4);
  });

  test('29. VPC Planner — first row tier contains "Public"', async ({ page }) => {
    await page.click('.vpc-count-btn[data-count="4"]');
    await expect(page.locator('#vpcResults table tbody tr').nth(0)).toContainText('Public');
  });

  test('30. VPC Planner — second row tier contains "Private"', async ({ page }) => {
    await page.click('.vpc-count-btn[data-count="4"]');
    await expect(page.locator('#vpcResults table tbody tr').nth(1)).toContainText('Private');
  });

  test('31. VPC Planner — all 4 CIDRs start with "10.0."', async ({ page }) => {
    await page.click('.vpc-count-btn[data-count="4"]');
    const rows = page.locator('#vpcResults table tbody tr');
    for (let i = 0; i < 4; i++) {
      // Second td holds the CIDR value
      await expect(rows.nth(i).locator('td').nth(1)).toContainText('10.0.');
    }
  });
});

// =============================================================================
// SCENARIO 2 — Network engineer verifying subnet boundaries (tests 32–37)
// =============================================================================

test.describe('Scenario 2 — Subnet Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await enterCIDR(page, '192.168.0.0/16');
  });

  test('32. 192.168.0.0/16 — Network Address is 192.168.0.0', async ({ page }) => {
    await expect(page.locator('#dNetAddr')).toHaveText('192.168.0.0');
  });

  test('33. 192.168.0.0/16 — Broadcast Address is 192.168.255.255', async ({ page }) => {
    await expect(page.locator('#dBcast')).toHaveText('192.168.255.255');
  });

  test('34. 192.168.0.0/16 — First Usable IP is 192.168.0.1', async ({ page }) => {
    await expect(page.locator('#dFirst')).toHaveText('192.168.0.1');
  });

  test('35. 192.168.0.0/16 — Last Usable IP is 192.168.255.254', async ({ page }) => {
    await expect(page.locator('#dLast')).toHaveText('192.168.255.254');
  });

  test('36. 192.168.0.0/16 — Usable Hosts shows 65,534', async ({ page }) => {
    await expect(page.locator('#statUsable')).toHaveText('65,534');
  });

  test('37. 192.168.0.0/16 — CIDR notation in detail panel is correct', async ({ page }) => {
    await expect(page.locator('#dCidr')).toHaveText('192.168.0.0/16');
  });
});

// =============================================================================
// SCENARIO 3 — Engineer splitting a datacenter block (tests 38–43)
// =============================================================================

test.describe('Scenario 3 — Datacenter Block Split', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.fill('#splitInput', '172.16.0.0/12');
    await page.click('.split-count-btn[data-count="4"]');
  });

  test('38. 172.16.0.0/12 in splitter — 4 rows appear', async ({ page }) => {
    await expect(page.locator('#splitResults table tbody tr')).toHaveCount(4);
  });

  test('39. First subnet starts with "172.16."', async ({ page }) => {
    await expect(
      page.locator('#splitResults table tbody tr').nth(0).locator('td').nth(0)
    ).toContainText('172.16.');
  });

  test('40. All 4 subnets are /14 prefixes', async ({ page }) => {
    const cidrs = page.locator('#splitResults table tbody tr td:first-child');
    for (let i = 0; i < 4; i++) {
      await expect(cidrs.nth(i)).toContainText('/14');
    }
  });

  test('41. All 4 subnets are distinct CIDRs', async ({ page }) => {
    const cidrs = page.locator('#splitResults table tbody tr td:first-child');
    const texts = await cidrs.allTextContents();
    const unique = new Set(texts.map(t => t.trim()));
    expect(unique.size).toBe(4);
  });

  test('42. Splitter result table has correct column headers', async ({ page }) => {
    const thead = page.locator('#splitResults table thead tr');
    await expect(thead).toContainText('CIDR');
    await expect(thead).toContainText('Network');
  });

  test('43. Each subnet row shows a non-empty host count', async ({ page }) => {
    const lastCols = page.locator('#splitResults table tbody tr td:last-child');
    for (let i = 0; i < 4; i++) {
      const val = (await lastCols.nth(i).textContent() ?? '').trim();
      expect(val.length).toBeGreaterThan(0);
      expect(val).not.toBe('0');
    }
  });
});

// =============================================================================
// SCENARIO 4 — Copy workflow (tests 44–48)
// =============================================================================

test.describe('Scenario 4 — Copy Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await enterCIDR(page, '10.0.0.0/24');
  });

  test('44. Network Address detail is 10.0.0.0 after entering 10.0.0.0/24', async ({ page }) => {
    await expect(page.locator('#dNetAddr')).toHaveText('10.0.0.0');
  });

  test('45. Copy button next to Network Address is present', async ({ page }) => {
    await expect(page.locator('.cbtn[data-t="dNetAddr"]')).toBeVisible();
  });

  test('46. Clicking copy next to Network Address shows a checkmark', async ({ page }) => {
    await page.evaluate(() => (document.querySelector('.cbtn[data-t="dNetAddr"]') as HTMLElement).click());
    await expect(page.locator('.cbtn[data-t="dNetAddr"] polyline')).toBeVisible({ timeout: 3_000 });
  });

  test('47. Copy button next to Subnet Mask is present', async ({ page }) => {
    await expect(page.locator('.cbtn[data-t="dMask"]')).toBeVisible();
  });

  test('48. Clicking copy next to Subnet Mask shows a checkmark', async ({ page }) => {
    await page.evaluate(() => (document.querySelector('.cbtn[data-t="dMask"]') as HTMLElement).click());
    await expect(page.locator('.cbtn[data-t="dMask"] polyline')).toBeVisible({ timeout: 3_000 });
  });
});

// =============================================================================
// SCENARIO 5 — IPv6 engineer workflow (tests 49–55)
// =============================================================================

test.describe('Scenario 5 — IPv6 Engineer Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await enterCIDR(page, '2001:db8::/32');
  });

  test('49. IPv6 badge appears after entering 2001:db8::/32', async ({ page }) => {
    await expect(page.locator('#ipvBadge')).toBeVisible();
    await expect(page.locator('#ipvBadge')).toContainText('IPv6');
  });

  test('50. Page does NOT show a "Broadcast Address" row for IPv6', async ({ page }) => {
    await expect(page.locator('#detailRows')).not.toContainText('Broadcast Address');
  });

  test('51. Page does NOT show a "Wildcard Mask" row for IPv6', async ({ page }) => {
    await expect(page.locator('#detailRows')).not.toContainText('Wildcard Mask');
  });

  test('52. Prefix Length "/32" appears in the subnet details panel', async ({ page }) => {
    await expect(page.locator('#dPrefix')).toHaveText('/32');
  });

  test('53. CIDR notation in detail panel is correct for IPv6', async ({ page }) => {
    await expect(page.locator('#dCidr')).toContainText('/32');
  });

  test('54. Clicking the IPv6 preset updates the input', async ({ page }) => {
    // Navigate fresh to test clicking the preset
    await page.goto(PAGE);
    await page.click('[data-cidr="2001:db8::/32"]');
    await expect(page.locator('#cidrInput')).toHaveValue('2001:db8::/32');
  });

  test('55. After IPv6 entry the No-Subnet-Mask stat label changes to "Address Type"', async ({ page }) => {
    await expect(page.locator('#statClassLabel')).toHaveText('Address Type');
  });
});

// =============================================================================
// SCENARIO 6 — Edge cases (tests 56–61)
// =============================================================================

test.describe('Scenario 6 — Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('56. 0.0.0.0/0 — Total Hosts shows 4,294,967,296', async ({ page }) => {
    await enterCIDR(page, '0.0.0.0/0');
    await expect(page.locator('#statTotal')).toHaveText('4,294,967,296');
  });

  test('57. 192.168.1.1/32 — Total Hosts is 1 and Usable Hosts is 0', async ({ page }) => {
    await enterCIDR(page, '192.168.1.1/32');
    await expect(page.locator('#statTotal')).toHaveText('1');
    await expect(page.locator('#statUsable')).toHaveText('0');
  });

  test('58. 192.168.1.0/31 — Total Hosts is 2 and Usable Hosts is 0', async ({ page }) => {
    await enterCIDR(page, '192.168.1.0/31');
    await expect(page.locator('#statTotal')).toHaveText('2');
    await expect(page.locator('#statUsable')).toHaveText('0');
  });

  test('59. 10.0.0.0/30 — Usable Hosts is 2', async ({ page }) => {
    await enterCIDR(page, '10.0.0.0/30');
    await expect(page.locator('#statUsable')).toHaveText('2');
  });

  test('60. Clearing the input completely shows an error message', async ({ page }) => {
    await page.fill('#cidrInput', '');
    await page.locator('#cidrInput').dispatchEvent('input');
    await expect(page.locator('#cidrError')).toBeVisible();
  });

  test('61. Entering an IP without CIDR prefix shows an error message', async ({ page }) => {
    await enterCIDR(page, '192.168.1.1');
    await expect(page.locator('#cidrError')).toBeVisible();
    await expect(page.locator('#cidrError')).toContainText('CIDR');
  });
});

// =============================================================================
// SCENARIO 7 — Usable hosts list (tests 62–66)
// =============================================================================

test.describe('Scenario 7 — Usable Hosts List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    // Default is already 192.168.1.0/24
  });

  test('62. First IP in the hosts list is 192.168.1.1', async ({ page }) => {
    await expect(page.locator('#hostsTable code').first()).toHaveText('192.168.1.1');
  });

  test('63. First three IPs are sequential (.1, .2, .3)', async ({ page }) => {
    const codes = page.locator('#hostsTable code');
    await expect(codes.nth(0)).toHaveText('192.168.1.1');
    await expect(codes.nth(1)).toHaveText('192.168.1.2');
    await expect(codes.nth(2)).toHaveText('192.168.1.3');
  });

  test('64. Host count note shows "254 usable hosts"', async ({ page }) => {
    await expect(page.locator('#hostCountNote')).toContainText('254');
    await expect(page.locator('#hostCountNote')).toContainText('usable hosts');
  });

  test('65. Pagination buttons are visible for a /24 (254 hosts, 4 pages)', async ({ page }) => {
    const pagination = page.locator('#hostsPagination');
    await expect(pagination).toBeVisible();
    // 254 hosts / 64 per page = ceil(254/64) = 4 pages
    await expect(pagination.locator('button')).toHaveCount(4);
  });

  test('66. Clicking next page shows IPs continuing sequentially', async ({ page }) => {
    await page.locator('#hostsPagination [data-pg="1"]').click();
    // Page 2 (index 1) starts at host #65 → 192.168.1.65
    await expect(page.locator('#hostsTable code').first()).toHaveText('192.168.1.65');
  });
});

// =============================================================================
// SCENARIO 8 — Navigation and SEO (tests 67–72)
// =============================================================================

test.describe('Scenario 8 — Navigation & SEO', () => {
  test('67. Canonical URL points to https://opsbash.com/cidr-calculator', async ({ page }) => {
    await page.goto(PAGE);
    const href = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(href).toBe('https://opsbash.com/cidr-calculator');
  });

  test('68. og:title contains "CIDR"', async ({ page }) => {
    await page.goto(PAGE);
    const og = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(og ?? '').toContain('CIDR');
  });

  test('69. At least two JSON-LD blocks exist (FAQ + WebApp)', async ({ page }) => {
    await page.goto(PAGE);
    const count = await page.locator('script[type="application/ld+json"]').count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('70. sitemap.xml contains /cidr-calculator', async ({ page }) => {
    await page.goto(PAGE);
    const resp = await page.request.get(`${BASE}/sitemap.xml`);
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    expect(body).toContain('/cidr-calculator');
  });

  test('71. Clicking the OpsBash logo navigates to the home page', async ({ page }) => {
    await page.goto(PAGE);
    await page.click('header a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
  });

  test('72. Home page has a CIDR Calculator card linking to /cidr-calculator', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('a[href="/cidr-calculator"]').first()).toBeVisible();
    await expect(page.locator('a[href="/cidr-calculator"]').first()).toContainText('CIDR');
  });
});
