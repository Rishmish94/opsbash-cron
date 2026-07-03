import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/json-diff`;

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

// Shared schema used across multiple Schema Validator tests
const BASE_SCHEMA = JSON.stringify({
  type: 'object',
  required: ['name', 'age'],
  properties: {
    name:  { type: 'string', minLength: 2 },
    age:   { type: 'number', minimum: 18 },
    email: { type: 'string' },
  },
});

// =============================================================================
// JSON DIFF  (tests 1–10)
// =============================================================================

test.describe('JSON Diff', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('1. Basic key change shows additions and deletions', async ({ page }) => {
    await page.fill('#diffOriginal', '{"name":"John","age":25,"city":"Delhi"}');
    await page.fill('#diffModified', '{"name":"John","age":26,"city":"Mumbai"}');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffResult')).toBeVisible();

    // At least one green (addition) line and one red (removal) line
    const addLines = page.locator('#diffOutput div[style*="rgba(34,197,94"]');
    const remLines = page.locator('#diffOutput div[style*="rgba(239,68,68"]');
    await expect(addLines.first()).toBeVisible();
    await expect(remLines.first()).toBeVisible();

    const summary = await page.locator('#diffSummary').textContent() ?? '';
    expect(summary).toContain('addition');
    expect(summary).toContain('deletion');
  });

  test('2. Semantic key reordering produces 0 additions and 0 deletions', async ({ page }) => {
    await page.fill('#diffOriginal', '{"b":2,"a":1}');
    await page.fill('#diffModified', '{"a":1,"b":2}');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffResult')).toBeVisible();
    const summary = await page.locator('#diffSummary').textContent() ?? '';
    expect(summary).toContain('0 additions');
    expect(summary).toContain('0 deletions');
  });

  test('3. Nested object diff shows changes when a nested value changes', async ({ page }) => {
    await page.fill('#diffOriginal', '{"user":{"name":"Rishabh","role":"admin"},"active":true}');
    await page.fill('#diffModified', '{"user":{"name":"Rishabh","role":"viewer"},"active":true}');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffResult')).toBeVisible();

    // role changed: "admin" → "viewer" means 1 addition + 1 deletion
    const summary = await page.locator('#diffSummary').textContent() ?? '';
    expect(summary).toContain('addition');
    expect(summary).toContain('deletion');
    const addLines = page.locator('#diffOutput div[style*="rgba(34,197,94"]');
    await expect(addLines.first()).toBeVisible();
  });

  test('4. Added new key shows 1 addition', async ({ page }) => {
    await page.fill('#diffOriginal', '{"name":"Rishabh"}');
    await page.fill('#diffModified', '{"name":"Rishabh","email":"r@opsbash.com"}');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffResult')).toBeVisible();
    const summary = await page.locator('#diffSummary').textContent() ?? '';
    expect(summary).toContain('1 addition');
  });

  test('5. Removed key shows 1 deletion', async ({ page }) => {
    await page.fill('#diffOriginal', '{"name":"Rishabh","email":"r@opsbash.com"}');
    await page.fill('#diffModified', '{"name":"Rishabh"}');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffResult')).toBeVisible();
    const summary = await page.locator('#diffSummary').textContent() ?? '';
    expect(summary).toContain('1 deletion');
  });

  test('6. Both inputs empty — no crash and diff result stays hidden', async ({ page }) => {
    await page.fill('#diffOriginal', '');
    await page.fill('#diffModified', '');
    await page.click('#diffCompareBtn');

    // Result panel must stay hidden; no error messages for empty inputs
    await expect(page.locator('#diffResult')).toBeHidden();
    await expect(page.locator('#diffOrigError')).toBeHidden();
    await expect(page.locator('#diffModError')).toBeHidden();
  });

  test('7. Invalid JSON in Original shows red error below Original textarea', async ({ page }) => {
    await page.fill('#diffOriginal', '{name:"Rishabh"}');
    await page.fill('#diffModified', '{"name":"Rishabh"}');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffOrigError')).toBeVisible();
    const errText = await page.locator('#diffOrigError').textContent() ?? '';
    expect(errText.trim().length).toBeGreaterThan(0);
    // Modified textarea has valid JSON so its error must stay hidden
    await expect(page.locator('#diffModError')).toBeHidden();
  });

  test('8. Invalid JSON in both inputs shows errors below both textareas', async ({ page }) => {
    await page.fill('#diffOriginal', '{bad json');
    await page.fill('#diffModified', '{also bad');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffOrigError')).toBeVisible();
    await expect(page.locator('#diffModError')).toBeVisible();
  });

  test('9. Array diff shows changes when an array element changes', async ({ page }) => {
    await page.fill('#diffOriginal', '{"tags":["aws","linux","docker"]}');
    await page.fill('#diffModified', '{"tags":["aws","linux","kubernetes"]}');
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffResult')).toBeVisible();
    // "docker" removed and "kubernetes" added
    const addLines = page.locator('#diffOutput div[style*="rgba(34,197,94"]');
    const remLines = page.locator('#diffOutput div[style*="rgba(239,68,68"]');
    await expect(addLines.first()).toBeVisible();
    await expect(remLines.first()).toBeVisible();
  });

  test('10. Terraform state diff shows changes when instance_type changes', async ({ page }) => {
    const resourceBase = {
      type: 'aws_instance',
      name: 'web',
      instances: [{ attributes: { ami: 'ami-123456', instance_type: '' } }],
    };

    const orig = JSON.stringify({
      version: 4,
      terraform_version: '1.5.0',
      resources: [{ ...resourceBase, instances: [{ attributes: { ami: 'ami-123456', instance_type: 't2.micro' } }] }],
    });
    const mod = JSON.stringify({
      version: 4,
      terraform_version: '1.5.0',
      resources: [{ ...resourceBase, instances: [{ attributes: { ami: 'ami-123456', instance_type: 't3.small' } }] }],
    });

    await page.fill('#diffOriginal', orig);
    await page.fill('#diffModified', mod);
    await page.click('#diffCompareBtn');

    await expect(page.locator('#diffResult')).toBeVisible();
    const addLines = page.locator('#diffOutput div[style*="rgba(34,197,94"]');
    const remLines = page.locator('#diffOutput div[style*="rgba(239,68,68"]');
    await expect(addLines.first()).toBeVisible();
    await expect(remLines.first()).toBeVisible();
  });
});

// =============================================================================
// SCHEMA VALIDATOR  (tests 11–16)
// =============================================================================

test.describe('Schema Validator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('11. Valid data passes — green success banner visible containing "Valid"', async ({ page }) => {
    await page.fill('#schemaData',   '{"name":"Rishabh","age":25,"email":"r@opsbash.com"}');
    await page.fill('#schemaSchema', BASE_SCHEMA);
    await page.click('#schemaValidateBtn');

    await expect(page.locator('#schemaResult')).toBeVisible();
    const text = await page.locator('#schemaResult').textContent() ?? '';
    expect(text).toContain('Valid');

    // Inner container should have green background
    const bg = await page.locator('#schemaResult div').first().evaluate(
      el => window.getComputedStyle(el as HTMLElement).backgroundColor
    );
    expect(bg).toMatch(/rgba?\(34,\s*197,\s*94/);
  });

  test('12. Missing required field — red error banner mentions "required"', async ({ page }) => {
    await page.fill('#schemaData',   '{"name":"Rishabh"}');  // age missing
    await page.fill('#schemaSchema', BASE_SCHEMA);
    await page.click('#schemaValidateBtn');

    await expect(page.locator('#schemaResult')).toBeVisible();
    const text = await page.locator('#schemaResult').textContent() ?? '';
    expect(text.toLowerCase()).toContain('required');
  });

  test('13. Wrong type — red error banner mentions type error', async ({ page }) => {
    await page.fill('#schemaData',   '{"name":"Rishabh","age":"twenty-five"}');  // age should be number
    await page.fill('#schemaSchema', BASE_SCHEMA);
    await page.click('#schemaValidateBtn');

    await expect(page.locator('#schemaResult')).toBeVisible();
    const text = await page.locator('#schemaResult').textContent() ?? '';
    expect(text.toLowerCase()).toContain('type');
  });

  test('14. Below minimum value — red error banner mentions minimum', async ({ page }) => {
    await page.fill('#schemaData',   '{"name":"Rishabh","age":15}');  // age < 18
    await page.fill('#schemaSchema', BASE_SCHEMA);
    await page.click('#schemaValidateBtn');

    await expect(page.locator('#schemaResult')).toBeVisible();
    const text = await page.locator('#schemaResult').textContent() ?? '';
    expect(text.toLowerCase()).toContain('minimum');
  });

  test('15. String too short — red error banner mentions minLength', async ({ page }) => {
    await page.fill('#schemaData',   '{"name":"R","age":25}');  // "R" length 1 < minLength 2
    await page.fill('#schemaSchema', BASE_SCHEMA);
    await page.click('#schemaValidateBtn');

    await expect(page.locator('#schemaResult')).toBeVisible();
    const text = await page.locator('#schemaResult').textContent() ?? '';
    expect(text.toLowerCase()).toContain('minlength');
  });

  test('16. Enum validation — error banner mentions enum or allowed values', async ({ page }) => {
    const enumSchema = JSON.stringify({
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
    });
    await page.fill('#schemaData',   '{"status":"pending"}');
    await page.fill('#schemaSchema', enumSchema);
    await page.click('#schemaValidateBtn');

    await expect(page.locator('#schemaResult')).toBeVisible();
    const text = await page.locator('#schemaResult').textContent() ?? '';
    const lower = text.toLowerCase();
    expect(
      lower.includes('enum') || lower.includes('active') || lower.includes('inactive')
    ).toBe(true);
  });
});

// =============================================================================
// JSON FORMATTER  (tests 17–21)
// =============================================================================

test.describe('JSON Formatter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('17. Live valid badge appears with green styling when valid JSON is typed', async ({ page }) => {
    await page.fill('#fmtInput', '{"name":"test"}');
    await page.waitForTimeout(300);

    await expect(page.locator('#fmtBadge')).toBeVisible();
    const text = await page.locator('#fmtBadge').textContent() ?? '';
    expect(text).toContain('Valid JSON');

    const color = await page.locator('#fmtBadge').evaluate(
      el => window.getComputedStyle(el as HTMLElement).color
    );
    expect(color).toMatch(/rgb\(74,\s*222,\s*128\)|#4ADE80/i);
  });

  test('18. Live invalid badge appears with red styling and error message when invalid JSON is typed', async ({ page }) => {
    await page.fill('#fmtInput', '{name:test}');
    await page.waitForTimeout(300);

    await expect(page.locator('#fmtBadge')).toBeVisible();
    const text = await page.locator('#fmtBadge').textContent() ?? '';
    expect(text).toContain('Invalid JSON');

    const color = await page.locator('#fmtBadge').evaluate(
      el => window.getComputedStyle(el as HTMLElement).color
    );
    expect(color).toMatch(/rgb\(248,\s*113,\s*113\)|#F87171/i);

    await expect(page.locator('#fmtError')).toBeVisible();
  });

  test('19. Format button pretty-prints JSON with 2-space indentation', async ({ page }) => {
    await page.fill('#fmtInput', '{"a":1,"b":2,"c":{"d":3}}');
    await page.click('#fmtFormatBtn');

    await expect(page.locator('#fmtOutputWrap')).toBeVisible();
    const out = await page.locator('#fmtOutput').inputValue();
    expect(out).toContain('\n');
    // 2-space indent before keys at depth 1
    expect(out).toMatch(/^  "/m);
    expect(out).toContain('"a": 1');
    expect(out).toContain('"b": 2');
    expect(out).toContain('"d": 3');
  });

  test('20. Minify button collapses formatted JSON to a single line', async ({ page }) => {
    const multiLine = '{\n  "key": "value",\n  "num": 42\n}';
    await page.fill('#fmtInput', multiLine);
    await page.click('#fmtMinifyBtn');

    await expect(page.locator('#fmtOutputWrap')).toBeVisible();
    const out = await page.locator('#fmtOutput').inputValue();
    expect(out).not.toContain('\n');
    expect(out).toBe('{"key":"value","num":42}');
  });

  test('21. Copy button shows "Copied!" temporarily after clicking', async ({ page }) => {
    await mockClipboard(page);
    await page.reload();  // apply initScript

    await page.fill('#fmtInput', '{"test":true}');
    await page.click('#fmtFormatBtn');
    await expect(page.locator('#fmtOutputWrap')).toBeVisible();

    await page.click('#fmtCopyBtn');
    await expect(page.locator('#fmtCopyBtn')).toHaveText('Copied!', { timeout: 3_000 });
  });
});
