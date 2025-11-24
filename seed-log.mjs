import { chromium } from "playwright-core";
import path from "path";
const executablePath = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1148', 'chrome-win', 'chrome.exe');
const run = async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const entry = {
    id: 'test-1',
    timestamp: Date.now(),
    values: { p: 7, c: 6, s: 4 },
    tags: ['test'],
    trend: 'up',
    note: 'playwright inserted'
  };
  await page.evaluate(async (e) => {
    const open = indexedDB.open('neuro-tracker-db', 2);
    const db = await new Promise((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readwrite');
      const store = tx.objectStore('logs');
      const req = store.put(e);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }, entry);
  await page.waitForTimeout(300);
  // click 4th nav button
  await page.click('nav button:nth-child(4)');
  await page.waitForSelector('text=Data Archives', { timeout: 5000 });
  await page.screenshot({ path: 'calendar.png', fullPage: true });
  const dayText = await page.textContent('div.flex-1.overflow-y-auto');
  console.log('Day text length', dayText?.length);
  await browser.close();
};
run();
