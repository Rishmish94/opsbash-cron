const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4321/timestamp-converter', { waitUntil: 'networkidle' });

  const getDisplay = () => page.evaluate(() => {
    const el = document.getElementById('epoch2038Badge');
    return el ? getComputedStyle(el).display : 'NO_ELEMENT';
  });

  const results = {};

  // 10-digit seconds value just over 2038 boundary
  await page.fill('#epochInput', '2147483648');
  await page.waitForTimeout(150);
  results.secBoundaryOver = await getDisplay();

  // 10-digit seconds value just under 2038 boundary
  await page.fill('#epochInput', '');
  await page.fill('#epochInput', '2147483646');
  await page.waitForTimeout(150);
  results.secBoundaryUnder = await getDisplay();

  // rapid toggling: type over, then under, then over again
  await page.fill('#epochInput', '');
  await page.fill('#epochInput', '2147483648');
  await page.waitForTimeout(100);
  await page.fill('#epochInput', '100');
  await page.waitForTimeout(100);
  await page.fill('#epochInput', '2147483648');
  await page.waitForTimeout(150);
  results.afterRapidToggle = await getDisplay();

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
