const { chromium } = require('playwright-core');
const path = require('path');
const executablePath = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1148', 'chrome-win', 'chrome.exe');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=记录状态', { timeout: 10000 });
  // click save
  await page.getByRole('button', { name: '记录状态' }).click();
  await page.waitForTimeout(500);
  // switch to calendar
  await page.getByRole('button', { name: '日历' }).click();
  await page.waitForSelector('text=Data Archives', { timeout: 10000 });
  await page.screenshot({ path: 'calendar.png', fullPage: true });
  const dayList = await page.textContent('div.flex-1.overflow-y-auto');
  console.log('Day list content length:', dayList?.length);
  await browser.close();
})();
