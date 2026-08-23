const { chromium, devices } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const randomDelay = (min = 2000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};

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
    const randomSession = Math.floor(10000 + Math.random() * 90000);
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

  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    proxy: proxyConfig
  });

  const context = await browser.newContext({
    ...devices['iPhone 14'],
    locale: 'en-US',
    timezoneId: 'America/New_York',
    hasTouch: true,
    isMobile: true
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  // MONITOR OUTBOUND WEBHOOKS & TRACKING PAYLOADS
  page.on('request', request => {
    const url = request.url();
    if (url.includes('google') || url.includes('script') || url.includes('trustedform') || url.includes('webhook') || url.includes('collect')) {
      console.log(`[NETWORK OUTBOUND TRACKING]: ${request.method()} -> ${url.substring(0, 90)}...`);
    }
  });

  try {
    console.log(`Navigating to target page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // SIMULATE HUMAN SCROLLING
    console.log("Simulating mobile scroll & gesture telemetry...");
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await randomDelay(2000, 4000);

    // SPECIFIC SELECTOR FOR TRACKED CALL CTA
    const callButton = page.locator('.quote-card a[href^="tel:"], .main-content a[href^="tel:"], a[href^="tel:"]').last();

    if (await callButton.isVisible({ timeout: 10000 })) {
      await callButton.scrollIntoViewIfNeeded({ behavior: 'smooth' });
      await randomDelay(1500, 3000);

      const box = await callButton.boundingBox();
      if (box) {
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        console.log(`Executing NATIVE TOUCH TAP (isTrusted: true) at X:${x}, Y:${y}...`);
        
        // Native Touchscreen API - Generates Genuine Hardware Touch Event
        await page.touchscreen.tap(x, y);
        console.log("Native physical touch tap dispatched!");
      } else {
        await callButton.click({ force: true });
      }
    } else {
      console.log("Call CTA button not found!");
    }

    console.log("Waiting 15 seconds to complete payload transmission...");
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
