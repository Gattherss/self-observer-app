import { chromium } from "playwright-core";
import path from "path";
const executablePath = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1148', 'chrome-win', 'chrome.exe');
const run = async () => {
  const browser = await chromium.launch({ headless: false, executablePath });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.click('text=¼ÇÂ¼×´Ì¬', { timeout: 10000 });
  await page.waitForTimeout(500);
  const logs = await page.evaluate(async () => {
    const open = indexedDB.open('neuro-tracker-db', 2);
    const db = await new Promise((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => resolve(open.result);
    });
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readonly');
      const store = tx.objectStore('logs');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return all;
  });
  console.log('Logs after click:', logs.length);
  await page.close();
  await browser.close();
};
run();
