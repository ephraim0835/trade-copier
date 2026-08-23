const { chromium } = require('playwright');
const fs = require('fs');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 }
    });
    
    // Visit page
    console.log('Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Hide Next.js dev error overlay if it exists (Aggressive removal)
    await page.evaluate(() => {
      setInterval(() => {
        const nextjsPortal = document.querySelector('nextjs-portal');
        if (nextjsPortal) nextjsPortal.remove();
        
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          if (iframe.src.includes('__nextjs') || iframe.id.includes('nextjs')) {
            iframe.remove();
          }
        });
      }, 100);
    });

    await page.waitForTimeout(2000); // Wait for animations to settle
    
    console.log('Capturing Desktop Light...');
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'desktop_light.png', fullPage: true });

    console.log('Capturing Desktop Dark...');
    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'desktop_dark.png', fullPage: true });
    
    console.log('Capturing Mobile Dark...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'mobile_dark.png', fullPage: true });
    
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

capture();
