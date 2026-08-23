import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  
  try {
    console.log('Navigating to Desktop Dark...');
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Hide nextjs overlay
    await page.evaluate(() => {
      const portal = document.querySelector('nextjs-portal');
      if (portal) portal.style.display = 'none';
    });
  
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(__dirname, '../desktop_dark.png'), fullPage: true });
    console.log('Desktop Dark captured.');
  
    console.log('Switching to Light Mode...');
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(__dirname, '../desktop_light.png'), fullPage: true });
    console.log('Desktop Light captured.');
  
    console.log('Navigating to Mobile Dark...');
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1' });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    await mobilePage.evaluate(() => {
      const portal = document.querySelector('nextjs-portal');
      if (portal) portal.style.display = 'none';
    });
    
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: join(__dirname, '../mobile_dark.png'), fullPage: true });
    console.log('Mobile Dark captured.');
  } catch (e) {
    console.error('Error during screenshot generation:', e);
  } finally {
    await browser.close();
  }
})();
