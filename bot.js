const { chromium, devices } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const randomDelay = (min = 1000, max = 3000) => {
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

  // MONITOR GOOGLE SHEET / WEBHOOK OUTBOUND RESPONSES
  page.on('response', response => {
    const url = response.url();
    if (url.includes('script.google.com') || url.includes('trustedform') || url.includes('webhook') || url.includes('docs.google.com')) {
      console.log(`[TRACKING WEBHOOK CONFIRMED]: Status ${response.status()} -> ${url}`);
    }
  });

  try {
    console.log(`Navigating to target landing page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // PREVENT `tel:` PROTOCOL FROM CANCELING JS EXECUTION
    await page.evaluate(() => {
      document.querySelectorAll('a[href^="tel:"]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault(); // Stop Linux OS call handler interruption
        }, true);
      });
    });

    // HUMAN SCROLL TELEMETRY
    console.log("Simulating mobile scroll telemetry...");
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await randomDelay(2000, 4000);

    // LOCATE BUTTON
    const callButton = page.locator('a[href^="tel:"], button:has-text("Call"), a:has-text("Call")').first();

    if (await callButton.isVisible({ timeout: 10000 })) {
      await callButton.scrollIntoViewIfNeeded({ behavior: 'smooth' });
      await randomDelay(1000, 2500);

      console.log("Dispatching click and forcing dataLayer event...");

      // Execute click + GTM event fallback
      await Promise.all([
        callButton.click({ force: true }),
        page.evaluate(() => {
          if (window.dataLayer) {
            window.dataLayer.push({
              'event': 'click_to_call',
              'eventCategory': 'CTA',
              'eventAction': 'Click',
              'eventLabel': 'Click-to-Call'
            });
          }
        })
      ]);

      console.log("Click dispatched successfully!");
    } else {
      console.log("Call CTA button not found on page.");
    }

    console.log("Waiting 15 seconds for Google Apps Script execution...");
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
