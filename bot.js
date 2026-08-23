const { chromium } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
// Removed trailing slash to prevent 404 routing errors
const TARGET_URL = (process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes').replace(/\/$/, "");

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const envServer = (process.env.PROXY_SERVER || '').trim().replace(/^["']|["']$/g, '');
  const envUser = (process.env.PROXY_USERNAME || '').trim().replace(/^["']|["']$/g, '');
  const envPass = (process.env.PROXY_PASSWORD || '').trim().replace(/^["']|["']$/g, '');

  const baseServer = envServer.length > 5 ? envServer : DEFAULT_SERVER;
  const baseUsername = envUser.length > 0 ? envUser : DEFAULT_USERNAME;
  const basePassword = envPass.length > 0 ? envPass : DEFAULT_PASSWORD;

  let finalUsername = baseUsername;
  if (USER_STATE) {
    const formattedState = USER_STATE.toLowerCase().trim().replace(/\s+/g, '_');
    const randomSession = getRandomInt(100000, 999999);
    finalUsername = `user-${baseUsername}-country-us-state-us_${formattedState}-session-${randomSession}`;
  }

  let serverUrl = baseServer;
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://') && !serverUrl.startsWith('socks5://')) {
    serverUrl = `http://${serverUrl}`;
  }

  let proxyConfig;
  try {
    const parsed = new URL(serverUrl);
    proxyConfig = {
      server: `${parsed.protocol}//${parsed.host}`,
      username: finalUsername,
      password: basePassword
    };
  } catch (urlErr) {
    proxyConfig = {
      server: DEFAULT_SERVER,
      username: finalUsername,
      password: DEFAULT_PASSWORD
    };
  }

  console.log(`[PROXY CONFIG]: Routing through ${proxyConfig.server} | Session: ${finalUsername}`);

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    proxy: proxyConfig
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    console.log(`1. Navigating to: ${TARGET_URL}`);
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Check if proxy returned 404/500 page
    if (response && response.status() >= 400) {
      console.log(`⚠️ Proxy response status ${response.status()}. Retrying direct target URL...`);
      await page.goto('https://securedrive-insurance.com/quotes', { waitUntil: 'networkidle' });
    }

    await delay(3000);

    // Verify if 404 text is on screen
    const is404 = await page.evaluate(() => document.body.innerText.includes('This page was not found'));
    if (is404) {
      console.log("⚠️ 404 Proxy Gateway error detected! Reloading page...");
      await page.reload({ waitUntil: 'networkidle' });
      await delay(2000);
    }

    console.log("2. Page successfully loaded! Proceeding with interactions...");
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await delay(2000);

    const callButton = page.locator('#callNowBtn, a[href^="tel:"]').first();
    if (await callButton.isVisible({ timeout: 10000 })) {
      console.log("3. Target CTA Button Found. Executing Click...");
      await callButton.click();
      console.log("✅ Click executed successfully!");
      await delay(5000);
    } else {
      console.log("❌ Call CTA button not visible on page.");
    }

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
