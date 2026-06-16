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

  // 1. Initial load, before typing
  results.initial = await getDisplay();

  // 2. Type a normal 13-digit ms timestamp
  await page.fill('#epochInput', '1750000000000');
  await page.waitForTimeout(200);
  results.normalTimestamp = await getDisplay();

  // 3. Type a 19-digit timestamp way beyond 2038
  await page.fill('#epochInput', '');
  await page.fill('#epochInput', '2147484647000000000');
  await page.waitForTimeout(200);
  results.beyond2038 = await getDisplay();

  // 4. Clear the input
  await page.fill('#epochInput', '');
  await page.waitForTimeout(200);
  results.afterClear = await getDisplay();

  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})();
